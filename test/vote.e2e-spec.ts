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

describe('VoteController (e2e)', () => {
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
   * Helper: create a room with users, start a game, and create picks for all users.
   * Returns { pin, gameId, firstRoundId, pickIds }.
   */
  async function createRoomGameAndPicks(
    hostId: string,
    hostName: string,
    guests: { id: string; name: string }[],
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

    const firstRoundId = gameRes.body.roundId;
    const allUserIds = [hostId, ...guests.map((g) => g.id)];

    // Create picks for all users
    for (let i = 0; i < allUserIds.length; i++) {
      await request(app.getHttpServer())
        .post('/pick')
        .query({ pin })
        .send({
          roundId: firstRoundId,
          userId: allUserIds[i],
          track: {
            id: `track-${hostId}-${i}`,
            title: `Title ${i}`,
            artist: `Artist ${i}`,
            album: `Album ${i}`,
            cover: `https://example.com/cover-${i}.jpg`,
            previewUrl: `https://example.com/preview-${i}.mp3`,
          },
        })
        .expect(201);
    }

    // Get pick IDs
    const picks = await prisma.pick.findMany({
      where: { roundId: firstRoundId },
      orderBy: { id: 'asc' },
    });

    return {
      pin,
      gameId: gameRes.body.gameId,
      firstRoundId,
      picks: picks.map((p) => ({ id: p.id, userId: p.userId })),
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

  describe('POST /vote', () => {
    it('should create a vote and emit vote:updated without nextPickId', async () => {
      const { pin, picks } = await createRoomGameAndPicks('host-1', 'Host', [
        { id: 'guest-1', name: 'Guest' },
      ]);

      const wsClient = await connectWs(pin, 'host-1');

      const voteUpdatedPromise = new Promise<any>((resolve) => {
        wsClient.on('vote:updated', (data) => resolve(data));
      });

      // host-1 votes on the first pick, guessing it belongs to guest-1
      await request(app.getHttpServer())
        .post('/vote')
        .query({ pin })
        .send({
          pickId: picks[0].id.toString(),
          guessId: 'guest-1',
          userId: 'host-1',
        })
        .expect(201);

      const wsData = await voteUpdatedPromise;
      expect(wsData.users).toEqual(['host-1']);
      // Not everyone voted yet → no nextPickId
      expect(wsData.nextPickId).toBeUndefined();

      // Verify vote was persisted
      const vote = await prisma.vote.findUnique({
        where: {
          pickId_guessUserId: { pickId: picks[0].id, guessUserId: 'host-1' },
        },
      });
      expect(vote).not.toBeNull();
      expect(vote.guessedUserId).toBe('guest-1');

      wsClient.disconnect();
    });

    it('should emit vote:updated with nextPickId when everyone has voted and there is a next pick', async () => {
      const { pin, picks } = await createRoomGameAndPicks('host-2', 'Host', [
        { id: 'guest-2', name: 'Guest' },
      ]);

      const wsClient = await connectWs(pin, 'host-2');

      // First vote
      await request(app.getHttpServer())
        .post('/vote')
        .query({ pin })
        .send({
          pickId: picks[0].id.toString(),
          guessId: 'guest-2',
          userId: 'host-2',
        })
        .expect(201);

      // Listen for vote:updated with all voters
      const allVotedPromise = new Promise<any>((resolve) => {
        wsClient.on('vote:updated', (data) => {
          if (data.users.length === 2) resolve(data);
        });
      });

      // Second vote
      await request(app.getHttpServer())
        .post('/vote')
        .query({ pin })
        .send({
          pickId: picks[0].id.toString(),
          guessId: 'host-2',
          userId: 'guest-2',
        })
        .expect(201);

      const wsData = await allVotedPromise;
      expect(wsData.users).toHaveLength(2);
      expect(wsData.users).toContain('host-2');
      expect(wsData.users).toContain('guest-2');
      // Everyone voted → nextPickId should be the second pick
      expect(wsData.nextPickId).toBe(picks[1].id);

      wsClient.disconnect();
    });

    it('should emit vote:updated with nextPickId null when all picks are voted', async () => {
      const { pin, picks } = await createRoomGameAndPicks('host-2b', 'Host', [
        { id: 'guest-2b', name: 'Guest' },
      ]);

      const wsClient = await connectWs(pin, 'host-2b');

      // Vote on all picks by both users
      for (const pick of picks) {
        await request(app.getHttpServer())
          .post('/vote')
          .query({ pin })
          .send({
            pickId: pick.id.toString(),
            guessId: 'guest-2b',
            userId: 'host-2b',
          })
          .expect(201);
      }

      // Listen for the final vote:updated (last pick, all voted)
      const lastVotePromise = new Promise<any>((resolve) => {
        wsClient.on('vote:updated', (data) => {
          if (data.users.length === 2 && data.nextPickId === null)
            resolve(data);
        });
      });

      // Last user votes on last pick
      for (const pick of picks) {
        await request(app.getHttpServer())
          .post('/vote')
          .query({ pin })
          .send({
            pickId: pick.id.toString(),
            guessId: 'host-2b',
            userId: 'guest-2b',
          })
          .expect(201);
      }

      const wsData = await lastVotePromise;
      expect(wsData.nextPickId).toBeNull();

      wsClient.disconnect();
    });
  });

  describe('DELETE /vote/:pickId/:userId', () => {
    it('should remove a vote and emit vote:updated with remaining voters', async () => {
      const { pin, picks } = await createRoomGameAndPicks('host-3', 'Host', [
        { id: 'guest-3', name: 'Guest' },
      ]);

      const wsClient = await connectWs(pin, 'host-3');

      // Create votes for both users
      await request(app.getHttpServer())
        .post('/vote')
        .query({ pin })
        .send({
          pickId: picks[0].id.toString(),
          guessId: 'guest-3',
          userId: 'host-3',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/vote')
        .query({ pin })
        .send({
          pickId: picks[0].id.toString(),
          guessId: 'host-3',
          userId: 'guest-3',
        })
        .expect(201);

      // Listen for vote:updated after cancel
      const cancelPromise = new Promise<any>((resolve) => {
        wsClient.on('vote:updated', (data) => {
          if (data.users.length === 1) resolve(data);
        });
      });

      // Cancel guest's vote
      await request(app.getHttpServer())
        .delete(`/vote/${picks[0].id}/guest-3`)
        .query({ pin })
        .expect(200);

      const wsData = await cancelPromise;
      expect(wsData.users).toEqual(['host-3']);

      // Verify vote was deleted from DB
      const deletedVote = await prisma.vote.findUnique({
        where: {
          pickId_guessUserId: { pickId: picks[0].id, guessUserId: 'guest-3' },
        },
      });
      expect(deletedVote).toBeNull();

      wsClient.disconnect();
    });

    it('should emit vote:updated with empty users when all votes are canceled', async () => {
      const { pin, picks } = await createRoomGameAndPicks('host-4', 'Host', [
        { id: 'guest-4', name: 'Guest' },
      ]);

      const wsClient = await connectWs(pin, 'host-4');

      // Create one vote
      await request(app.getHttpServer())
        .post('/vote')
        .query({ pin })
        .send({
          pickId: picks[0].id.toString(),
          guessId: 'guest-4',
          userId: 'host-4',
        })
        .expect(201);

      // Listen for vote:updated after cancel
      const cancelPromise = new Promise<any>((resolve) => {
        wsClient.on('vote:updated', (data) => {
          if (data.users.length === 0) resolve(data);
        });
      });

      // Cancel the only vote
      await request(app.getHttpServer())
        .delete(`/vote/${picks[0].id}/host-4`)
        .query({ pin })
        .expect(200);

      const wsData = await cancelPromise;
      expect(wsData.users).toEqual([]);

      wsClient.disconnect();
    });
  });
});
