import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { Socket as ClientSocket, io } from 'socket.io-client';
import request from 'supertest';
import { GameModule } from '../src/game/game.module';
import { PrismaClient } from '../src/generated/prisma/client';
import { PickModule } from '../src/pick/pick.module';
import { PrismaModule } from '../src/prisma.module';
import { PrismaService } from '../src/prisma.service';
import { RoomModule } from '../src/room/room.module';
import { pushSchema } from './setup-e2e';

dotenv.config({ path: '.env.test' });

describe('PickController (e2e)', () => {
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
      imports: [PrismaModule, RoomModule, GameModule, PickModule],
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
    await prisma.track.deleteMany();
    await prisma.round.deleteMany();
    await prisma.game.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();
  });

  /**
   * Helper: create a room with users and start a game.
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

  function connectWs(pin: string, userId: string): Promise<ClientSocket> {
    return new Promise((resolve) => {
      const client: ClientSocket = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      client.on('connect', () => {
        client.emit('room:subscribe', { pin, userId });
        setTimeout(() => resolve(client), 100);
      });
    });
  }

  function makeTrack(suffix: string) {
    return {
      id: `track-${suffix}`,
      title: `Title ${suffix}`,
      artist: `Artist ${suffix}`,
      previewUrl: `https://example.com/preview-${suffix}.mp3`,
    };
  }

  describe('POST /pick', () => {
    it('should assign a track and emit pick:updated with the user id', async () => {
      const { pin, firstRoundId } = await createRoomAndGame('host-1', 'Host', [
        { id: 'guest-1', name: 'Guest' },
      ]);

      const wsClient = await connectWs(pin, 'host-1');

      const pickUpdatedPromise = new Promise<any>((resolve) => {
        wsClient.on('pick:updated', (data) => resolve(data));
      });

      await request(app.getHttpServer())
        .post('/pick')
        .query({ pin })
        .send({
          roundId: firstRoundId,
          userId: 'host-1',
          track: makeTrack('1'),
        })
        .expect(201);

      const wsData = await pickUpdatedPromise;
      expect(wsData.users).toEqual(['host-1']);

      // Verify pick was persisted
      const pick = await prisma.pick.findUnique({
        where: { roundId_userId: { roundId: firstRoundId, userId: 'host-1' } },
        include: { track: true },
      });
      expect(pick).not.toBeNull();
      expect(pick.track.id).toBe('track-1');

      wsClient.disconnect();
    });

    it('should emit pick:updated with all user ids when everyone has picked', async () => {
      const { pin, firstRoundId } = await createRoomAndGame('host-2', 'Host', [
        { id: 'guest-2', name: 'Guest' },
      ]);

      const wsClient = await connectWs(pin, 'host-2');

      // First pick
      await request(app.getHttpServer())
        .post('/pick')
        .query({ pin })
        .send({
          roundId: firstRoundId,
          userId: 'host-2',
          track: makeTrack('a'),
        })
        .expect(201);

      // Listen for the second pick:updated (all picked)
      const allPickedPromise = new Promise<any>((resolve) => {
        wsClient.on('pick:updated', (data) => {
          if (data.users.length === 2) resolve(data);
        });
      });

      // Second pick
      await request(app.getHttpServer())
        .post('/pick')
        .query({ pin })
        .send({
          roundId: firstRoundId,
          userId: 'guest-2',
          track: makeTrack('b'),
        })
        .expect(201);

      const wsData = await allPickedPromise;
      expect(wsData.users).toHaveLength(2);
      expect(wsData.users).toContain('host-2');
      expect(wsData.users).toContain('guest-2');

      wsClient.disconnect();
    });
  });

  describe('DELETE /pick/:roundId/:userId', () => {
    it('should remove a pick and emit pick:updated with remaining users', async () => {
      const { pin, firstRoundId } = await createRoomAndGame('host-4', 'Host', [
        { id: 'guest-4', name: 'Guest' },
      ]);

      const wsClient = await connectWs(pin, 'host-4');

      // Create picks for both users
      await request(app.getHttpServer())
        .post('/pick')
        .query({ pin })
        .send({
          roundId: firstRoundId,
          userId: 'host-4',
          track: makeTrack('x'),
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/pick')
        .query({ pin })
        .send({
          roundId: firstRoundId,
          userId: 'guest-4',
          track: makeTrack('y'),
        })
        .expect(201);

      // Listen for pick:updated after cancel
      const cancelPromise = new Promise<any>((resolve) => {
        wsClient.on('pick:updated', (data) => {
          if (data.users.length === 1) resolve(data);
        });
      });

      // Cancel guest's pick
      await request(app.getHttpServer())
        .delete(`/pick/${firstRoundId}/guest-4`)
        .query({ pin })
        .expect(200);

      const wsData = await cancelPromise;
      expect(wsData.users).toEqual(['host-4']);

      // Verify pick was deleted from DB
      const deletedPick = await prisma.pick.findUnique({
        where: {
          roundId_userId: { roundId: firstRoundId, userId: 'guest-4' },
        },
      });
      expect(deletedPick).toBeNull();

      wsClient.disconnect();
    });

    it('should emit pick:updated with empty users when all picks are canceled', async () => {
      const { pin, firstRoundId } = await createRoomAndGame('host-5', 'Host', [
        { id: 'guest-5', name: 'Guest' },
      ]);

      const wsClient = await connectWs(pin, 'host-5');

      // Create one pick
      await request(app.getHttpServer())
        .post('/pick')
        .query({ pin })
        .send({
          roundId: firstRoundId,
          userId: 'host-5',
          track: makeTrack('z'),
        })
        .expect(201);

      // Listen for pick:updated after cancel
      const cancelPromise = new Promise<any>((resolve) => {
        wsClient.on('pick:updated', (data) => {
          if (data.users.length === 0) resolve(data);
        });
      });

      // Cancel the only pick
      await request(app.getHttpServer())
        .delete(`/pick/${firstRoundId}/host-5`)
        .query({ pin })
        .expect(200);

      const wsData = await cancelPromise;
      expect(wsData.users).toEqual([]);

      wsClient.disconnect();
    });
  });

  describe('GET /pick/:pickId', () => {
    it('should return a pick with its track', async () => {
      const { pin, firstRoundId } = await createRoomAndGame('host-6', 'Host', [
        { id: 'guest-6', name: 'Guest' },
      ]);

      await request(app.getHttpServer())
        .post('/pick')
        .query({ pin })
        .send({
          roundId: firstRoundId,
          userId: 'host-6',
          track: makeTrack('get'),
        })
        .expect(201);

      const pick = await prisma.pick.findUnique({
        where: {
          roundId_userId: { roundId: firstRoundId, userId: 'host-6' },
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/pick/${pick.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: pick.id,
        track: {
          id: 'track-get',
          title: 'Title get',
          artist: 'Artist get',
        },
      });
    });
  });
});
