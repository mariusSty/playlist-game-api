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
import { pushSchema } from './setup-e2e';

dotenv.config({ path: '.env.test' });

describe('GameController (e2e)', () => {
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
      imports: [PrismaModule, RoomModule, GameModule],
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
    await prisma.round.deleteMany();
    await prisma.game.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();
  });

  /**
   * Helper: create a room with a host and optional guests, returns the pin.
   */
  async function createRoomWithUsers(
    hostId: string,
    hostName: string,
    guests: { id: string; name: string }[] = [],
  ): Promise<string> {
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

    return pin;
  }

  describe('POST /game', () => {
    it('should create a game with rounds, assign themeMasters, and emit gameStarted', async () => {
      const pin = await createRoomWithUsers('host-1', 'Host', [
        { id: 'guest-1', name: 'Alice' },
        { id: 'guest-2', name: 'Bob' },
      ]);

      // Connect a WebSocket client and subscribe to the room
      const wsClient: ClientSocket = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await new Promise<void>((resolve) => wsClient.on('connect', resolve));
      wsClient.emit('room:subscribe', { pin, userId: 'host-1' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const gameStartedPromise = new Promise<any>((resolve) => {
        wsClient.on('gameStarted', (data) => resolve(data));
      });

      const response = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      expect(response.body).toMatchObject({
        roundId: expect.any(Number),
        gameId: expect.any(Number),
      });

      // Verify game was created in DB with correct relations
      const game = await prisma.game.findFirst({
        where: {
          roomId: (await prisma.room.findUnique({ where: { pin } })).id,
        },
        include: { rounds: true, users: true },
      });

      expect(game).not.toBeNull();
      expect(game.users).toHaveLength(3);
      expect(game.rounds).toHaveLength(3); // one round per user

      // Each user should be a themeMaster for exactly one round
      const themeMasterIds = game.rounds.map((r) => r.themeMasterId).sort();
      expect(themeMasterIds).toEqual(['guest-1', 'guest-2', 'host-1'].sort());

      // Verify WebSocket event was emitted
      const wsData = await gameStartedPromise;
      expect(wsData.pin).toBe(pin);
      expect(wsData.roundId).toBe(response.body.roundId);
      expect(wsData.gameId).toBe(response.body.gameId);

      wsClient.disconnect();
    });

    it('should return 404 for a non-existent room pin', async () => {
      await request(app.getHttpServer())
        .post('/game')
        .send({ pin: '000000' })
        .expect(404);
    });
  });

  describe('GET /game/:id', () => {
    it('should return a game with users, rounds, themeMasters, picks and votes', async () => {
      const pin = await createRoomWithUsers('host-get', 'Host', [
        { id: 'guest-get', name: 'Guest' },
      ]);

      const createRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const gameId = createRes.body.gameId;

      const response = await request(app.getHttpServer())
        .get(`/game/${gameId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: gameId,
        users: expect.any(Array),
        rounds: expect.any(Array),
      });
      expect(response.body.users).toHaveLength(2);
      expect(response.body.rounds).toHaveLength(2);

      // Each round should include themeMaster and picks
      for (const round of response.body.rounds) {
        expect(round).toHaveProperty('themeMaster');
        expect(round).toHaveProperty('picks');
        expect(round.themeMaster).toHaveProperty('id');
      }
    });

    it('should return 500 for a non-existent game id', async () => {
      await request(app.getHttpServer()).get('/game/99999').expect(500);
    });
  });

  describe('PATCH /game/:id/finish', () => {
    it('should detach the room from the game', async () => {
      const pin = await createRoomWithUsers('host-finish-1', 'Host', [
        { id: 'guest-finish-1', name: 'Guest' },
      ]);

      const createRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const gameId = createRes.body.gameId;

      // Verify the game is attached to the room
      const gameBefore = await prisma.game.findUnique({
        where: { id: gameId },
      });
      expect(gameBefore.roomId).not.toBeNull();

      const response = await request(app.getHttpServer())
        .patch(`/game/${gameId}/finish`)
        .expect(200);

      expect(response.body).toEqual({ finished: true });

      // Verify the room was detached
      const gameAfter = await prisma.game.findUnique({
        where: { id: gameId },
      });
      expect(gameAfter.roomId).toBeNull();
    });
  });
});
