import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { Socket as ClientSocket, io } from 'socket.io-client';
import request from 'supertest';
import { GameModule } from '../src/game/game.module';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaModule } from '../src/prisma.module';
import { PrismaService } from '../src/prisma.service';
import { RoomModule } from '../src/room/room.module';
import { RoundModule } from '../src/round/round.module';
import { SessionModule } from '../src/session/session.module';
import { pushSchema } from './setup-e2e';

dotenv.config({ path: '.env.test' });

describe('RoundController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let wsPort: number;

  beforeAll(async () => {
    pushSchema();

    const adapter = new PrismaPg({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PrismaModule,
        SessionModule,
        RoomModule,
        GameModule,
        RoundModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        client: prisma,
        onModuleInit: () => Promise.resolve(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const address = app.getHttpServer().listen().address();
    wsPort = typeof address === 'string' ? 0 : (address as any).port;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  afterEach(async () => {
    await prisma.vote.deleteMany();
    await prisma.pick.deleteMany();
    await prisma.roundReady.deleteMany();
    await prisma.round.deleteMany();
    await prisma.game.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();
  });

  /**
   * Helper: create a room with users and start a game. Returns { pin, gameId, firstRoundId }.
   */
  async function createRoomAndGame(
    hostId: string,
    hostName: string,
    guests: { id: string; name: string }[] = [],
  ) {
    const createRes = await request(app.getHttpServer())
      .post('/room')
      .send({ id: hostId, name: hostName })
      .expect(201);

    const pin = createRes.body.pin;

    for (const guest of guests) {
      await request(app.getHttpServer())
        .patch(`/room/${pin}`)
        .send({ id: guest.id, name: guest.name })
        .expect(200);
    }

    const gameRes = await request(app.getHttpServer())
      .post('/game')
      .send({ pin })
      .expect(201);

    return {
      pin,
      gameId: gameRes.body.gameId,
      firstRoundId: gameRes.body.roundId,
    };
  }

  describe('GET /round/:roundId', () => {
    it('should return the round with all relations', async () => {
      const { firstRoundId } = await createRoomAndGame('host-get-1', 'Host', [
        { id: 'guest-get-1', name: 'Guest' },
      ]);

      const response = await request(app.getHttpServer())
        .get(`/round/${firstRoundId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: firstRoundId,
        themeId: null,
        customTheme: null,
      });
      expect(response.body.themeMaster).toBeDefined();
      expect(response.body.game).toBeDefined();
      expect(response.body.picks).toBeDefined();
    });

    it('should return 404 for a non-existent round', async () => {
      await request(app.getHttpServer()).get('/round/99999').expect(404);
    });
  });

  describe('PATCH /round/:roundId', () => {
    it('should update the theme and emit session:updated when called by the themeMaster', async () => {
      const { pin, firstRoundId } = await createRoomAndGame('host-1', 'Host', [
        { id: 'guest-1', name: 'Guest' },
      ]);

      // Get the round to find the themeMaster
      const round = await prisma.round.findUnique({
        where: { id: firstRoundId },
      });

      // Connect a WebSocket client and subscribe to the room
      const wsClient: ClientSocket = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await new Promise<void>((resolve) => wsClient.on('connect', resolve));
      wsClient.emit('session:subscribe', { pin, userId: round.themeMasterId });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const gameStateChangedPromise = new Promise<void>((resolve) => {
        wsClient.on('session:updated', () => resolve());
      });

      // ThemeMaster picks the theme
      const response = await request(app.getHttpServer())
        .patch(`/round/${firstRoundId}`)
        .send({ customTheme: 'Summer Vibes', userId: round.themeMasterId, pin })
        .expect(200);

      expect(response.body).toMatchObject({
        id: firstRoundId,
        customTheme: 'Summer Vibes',
      });

      // Verify the round was updated in DB
      const updated = await prisma.round.findUnique({
        where: { id: firstRoundId },
      });
      expect(updated.customTheme).toBe('Summer Vibes');

      // Verify WebSocket event was emitted
      await gameStateChangedPromise;

      wsClient.disconnect();
    });

    it('should return 403 when a non-themeMaster tries to pick the theme', async () => {
      const { pin, firstRoundId } = await createRoomAndGame('host-2', 'Host', [
        { id: 'guest-2', name: 'Guest' },
      ]);

      // Get the round to find who is NOT the themeMaster
      const round = await prisma.round.findUnique({
        where: { id: firstRoundId },
      });
      const nonThemeMaster =
        round.themeMasterId === 'host-2' ? 'guest-2' : 'host-2';

      const response = await request(app.getHttpServer())
        .patch(`/round/${firstRoundId}`)
        .send({ customTheme: 'Hacked Theme', userId: nonThemeMaster, pin })
        .expect(403);

      expect(response.body.message).toBe(
        'Only the theme master can pick the theme',
      );

      // Verify the theme was NOT updated
      const unchanged = await prisma.round.findUnique({
        where: { id: firstRoundId },
      });
      expect(unchanged.customTheme).toBeNull();
      expect(unchanged.themeId).toBeNull();
    });

    it('should return 404 for a non-existent round', async () => {
      await request(app.getHttpServer())
        .patch('/round/99999')
        .send({ customTheme: 'Whatever', userId: 'nobody', pin: '000000' })
        .expect(404);
    });
  });

  describe('POST /round/:roundId/ready', () => {
    it('does not complete the round when only some players are ready', async () => {
      const { pin, firstRoundId } = await createRoomAndGame(
        'host-ready-1',
        'Host',
        [
          { id: 'guest-ready-1', name: 'Guest A' },
          { id: 'guest-ready-2', name: 'Guest B' },
        ],
      );

      await prisma.round.update({
        where: { id: firstRoundId },
        data: { customTheme: 'Done' },
      });

      const response = await request(app.getHttpServer())
        .post(`/round/${firstRoundId}/ready`)
        .send({ userId: 'host-ready-1', pin })
        .expect(201);

      expect(response.body).toMatchObject({
        readyCount: 1,
        totalCount: 3,
        completed: false,
      });

      const updated = await prisma.round.findUnique({
        where: { id: firstRoundId },
      });
      expect(updated.revealCompleted).toBe(false);
    });

    it('completes the round and emits session:updated once everyone is ready', async () => {
      const { pin, firstRoundId } = await createRoomAndGame(
        'host-ready-3',
        'Host',
        [{ id: 'guest-ready-3', name: 'Guest' }],
      );

      await prisma.round.update({
        where: { id: firstRoundId },
        data: { customTheme: 'Done' },
      });

      // First player ready: not yet complete
      await request(app.getHttpServer())
        .post(`/round/${firstRoundId}/ready`)
        .send({ userId: 'host-ready-3', pin })
        .expect(201);

      let stored = await prisma.round.findUnique({
        where: { id: firstRoundId },
      });
      expect(stored.revealCompleted).toBe(false);

      // Subscribe to WS before the final ready call to assert the broadcast
      const wsClient: ClientSocket = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve) => wsClient.on('connect', resolve));
      wsClient.emit('session:subscribe', { pin, userId: 'host-ready-3' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const gameStateChangedPromise = new Promise<void>((resolve) => {
        wsClient.on('session:updated', () => resolve());
      });

      const response = await request(app.getHttpServer())
        .post(`/round/${firstRoundId}/ready`)
        .send({ userId: 'guest-ready-3', pin })
        .expect(201);

      expect(response.body).toMatchObject({
        readyCount: 2,
        totalCount: 2,
        completed: true,
      });

      stored = await prisma.round.findUnique({
        where: { id: firstRoundId },
      });
      expect(stored.revealCompleted).toBe(true);

      await gameStateChangedPromise;

      wsClient.disconnect();
    });

    it('is idempotent when the same user marks ready twice', async () => {
      const { pin, firstRoundId } = await createRoomAndGame(
        'host-ready-5',
        'Host',
        [{ id: 'guest-ready-5', name: 'Guest' }],
      );

      await prisma.round.update({
        where: { id: firstRoundId },
        data: { customTheme: 'Done' },
      });

      await request(app.getHttpServer())
        .post(`/round/${firstRoundId}/ready`)
        .send({ userId: 'host-ready-5', pin })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/round/${firstRoundId}/ready`)
        .send({ userId: 'host-ready-5', pin })
        .expect(201);

      expect(response.body).toMatchObject({
        readyCount: 1,
        totalCount: 2,
        completed: false,
      });
    });

    it('returns 404 when the user is not part of the game', async () => {
      const { pin, firstRoundId } = await createRoomAndGame(
        'host-ready-6',
        'Host',
        [{ id: 'guest-ready-6', name: 'Guest' }],
      );

      await prisma.user.create({ data: { id: 'outsider-1', name: 'Outside' } });

      await request(app.getHttpServer())
        .post(`/round/${firstRoundId}/ready`)
        .send({ userId: 'outsider-1', pin })
        .expect(404);
    });

    it('returns 404 for a non-existent round', async () => {
      await request(app.getHttpServer())
        .post('/round/99999/ready')
        .send({ userId: 'whoever', pin: '000000' })
        .expect(404);
    });
  });
});
