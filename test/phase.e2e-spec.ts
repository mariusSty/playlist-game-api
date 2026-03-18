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
import { RoundModule } from '../src/round/round.module';
import { pushSchema } from './setup-e2e';

dotenv.config({ path: '.env.test' });

describe('Phase endpoints (e2e)', () => {
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
      imports: [PrismaModule, RoomModule, GameModule, RoundModule, PickModule],
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

  describe('GET /room/:pin/phase', () => {
    it('should return lobby when no game is active', async () => {
      const pin = await createRoomWithUsers('host-phase-1', 'Host');

      const res = await request(app.getHttpServer())
        .get(`/room/${pin}/phase`)
        .expect(200);

      expect(res.body).toEqual({ phase: 'lobby' });
    });

    it('should return playing with gameId when a game is active', async () => {
      const pin = await createRoomWithUsers('host-phase-2', 'Host', [
        { id: 'guest-phase-2', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/room/${pin}/phase`)
        .expect(200);

      expect(res.body).toEqual({
        phase: 'playing',
        gameId: gameRes.body.gameId,
      });
    });

    it('should return lobby after game is finished', async () => {
      const pin = await createRoomWithUsers('host-phase-3', 'Host', [
        { id: 'guest-phase-3', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/game/${gameRes.body.gameId}/finish`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/room/${pin}/phase`)
        .expect(200);

      expect(res.body).toEqual({ phase: 'lobby' });
    });

    it('should return 404 for non-existent room', async () => {
      await request(app.getHttpServer()).get('/room/000000/phase').expect(404);
    });
  });

  describe('GET /game/:id/phase', () => {
    it('should return theme phase at game start', async () => {
      const pin = await createRoomWithUsers('host-gp-1', 'Host', [
        { id: 'guest-gp-1', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/game/${gameRes.body.gameId}/phase`)
        .expect(200);

      expect(res.body).toEqual({
        phase: 'theme',
        roundId: gameRes.body.roundId,
      });
    });

    it('should return song phase after theme is picked', async () => {
      const pin = await createRoomWithUsers('host-gp-2', 'Host', [
        { id: 'guest-gp-2', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const roundId = gameRes.body.roundId;

      // Find the theme master for this round
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ theme: 'Rock', userId: round.themeMasterId, pin })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/game/${gameRes.body.gameId}/phase`)
        .expect(200);

      expect(res.body).toEqual({
        phase: 'song',
        roundId,
      });
    });

    it('should return vote phase when all picks are done', async () => {
      const pin = await createRoomWithUsers('host-gp-3', 'Host', [
        { id: 'guest-gp-3', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const roundId = gameRes.body.roundId;
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      // Pick theme
      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ theme: 'Jazz', userId: round.themeMasterId, pin })
        .expect(200);

      // Create tracks and picks for all users
      await prisma.track.createMany({
        data: [
          {
            id: 'track-gp-3a',
            title: 'S1',
            artist: 'A1',
            album: 'Al1',
            cover: 'c1',
            previewUrl: 'p1',
          },
          {
            id: 'track-gp-3b',
            title: 'S2',
            artist: 'A2',
            album: 'Al2',
            cover: 'c2',
            previewUrl: 'p2',
          },
        ],
      });
      await prisma.pick.createMany({
        data: [
          { roundId, userId: 'host-gp-3', trackId: 'track-gp-3a' },
          { roundId, userId: 'guest-gp-3', trackId: 'track-gp-3b' },
        ],
      });

      const res = await request(app.getHttpServer())
        .get(`/game/${gameRes.body.gameId}/phase`)
        .expect(200);

      expect(res.body.phase).toBe('vote');
      expect(res.body.roundId).toBe(roundId);
      expect(res.body.pickId).toEqual(expect.any(Number));
    });

    it('should return reveal phase when all votes are done', async () => {
      const pin = await createRoomWithUsers('host-gp-4', 'Host', [
        { id: 'guest-gp-4', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const roundId = gameRes.body.roundId;
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      // Pick theme
      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ theme: 'Pop', userId: round.themeMasterId, pin })
        .expect(200);

      // Create tracks and picks
      await prisma.track.createMany({
        data: [
          {
            id: 'track-gp-4a',
            title: 'S1',
            artist: 'A1',
            album: 'Al1',
            cover: 'c1',
            previewUrl: 'p1',
          },
          {
            id: 'track-gp-4b',
            title: 'S2',
            artist: 'A2',
            album: 'Al2',
            cover: 'c2',
            previewUrl: 'p2',
          },
        ],
      });
      const picks = await Promise.all([
        prisma.pick.create({
          data: { roundId, userId: 'host-gp-4', trackId: 'track-gp-4a' },
        }),
        prisma.pick.create({
          data: { roundId, userId: 'guest-gp-4', trackId: 'track-gp-4b' },
        }),
      ]);

      // All users vote on all picks (2 users × 2 picks = 4 votes)
      await prisma.vote.createMany({
        data: [
          {
            pickId: picks[0].id,
            guessUserId: 'host-gp-4',
            guessedUserId: 'host-gp-4',
          },
          {
            pickId: picks[0].id,
            guessUserId: 'guest-gp-4',
            guessedUserId: 'host-gp-4',
          },
          {
            pickId: picks[1].id,
            guessUserId: 'host-gp-4',
            guessedUserId: 'guest-gp-4',
          },
          {
            pickId: picks[1].id,
            guessUserId: 'guest-gp-4',
            guessedUserId: 'guest-gp-4',
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .get(`/game/${gameRes.body.gameId}/phase`)
        .expect(200);

      expect(res.body).toEqual({
        phase: 'reveal',
        roundId,
      });
    });

    it('should return result phase when game is finished', async () => {
      const pin = await createRoomWithUsers('host-gp-5', 'Host', [
        { id: 'guest-gp-5', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/game/${gameRes.body.gameId}/finish`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/game/${gameRes.body.gameId}/phase`)
        .expect(200);

      expect(res.body).toEqual({ phase: 'result' });
    });

    it('should return theme for next round after completing first round', async () => {
      const pin = await createRoomWithUsers('host-gp-6', 'Host', [
        { id: 'guest-gp-6', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const gameId = gameRes.body.gameId;
      const firstRoundId = gameRes.body.roundId;

      // Get all rounds
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { rounds: { orderBy: { id: 'asc' } } },
      });
      const secondRound = game.rounds[1];

      // Complete first round: pick theme, picks, all votes
      const firstRound = await prisma.round.findUnique({
        where: { id: firstRoundId },
      });
      await request(app.getHttpServer())
        .patch(`/round/${firstRoundId}`)
        .send({ theme: 'Rock', userId: firstRound.themeMasterId, pin })
        .expect(200);

      await prisma.track.createMany({
        data: [
          {
            id: 'track-gp-6a',
            title: 'S1',
            artist: 'A1',
            album: 'Al1',
            cover: 'c1',
            previewUrl: 'p1',
          },
          {
            id: 'track-gp-6b',
            title: 'S2',
            artist: 'A2',
            album: 'Al2',
            cover: 'c2',
            previewUrl: 'p2',
          },
        ],
      });
      const picks = await Promise.all([
        prisma.pick.create({
          data: {
            roundId: firstRoundId,
            userId: 'host-gp-6',
            trackId: 'track-gp-6a',
          },
        }),
        prisma.pick.create({
          data: {
            roundId: firstRoundId,
            userId: 'guest-gp-6',
            trackId: 'track-gp-6b',
          },
        }),
      ]);
      await prisma.vote.createMany({
        data: [
          {
            pickId: picks[0].id,
            guessUserId: 'host-gp-6',
            guessedUserId: 'host-gp-6',
          },
          {
            pickId: picks[0].id,
            guessUserId: 'guest-gp-6',
            guessedUserId: 'host-gp-6',
          },
          {
            pickId: picks[1].id,
            guessUserId: 'host-gp-6',
            guessedUserId: 'guest-gp-6',
          },
          {
            pickId: picks[1].id,
            guessUserId: 'guest-gp-6',
            guessedUserId: 'guest-gp-6',
          },
        ],
      });

      // First round is fully completed (reveal state)
      const revealRes = await request(app.getHttpServer())
        .get(`/game/${gameId}/phase`)
        .expect(200);
      expect(revealRes.body).toEqual({
        phase: 'reveal',
        roundId: firstRoundId,
      });

      // Mark reveal as completed via nextRound
      await request(app.getHttpServer())
        .post(`/round/next?pin=${pin}`)
        .expect(201);

      // Phase should now be theme for second round
      const themeRes = await request(app.getHttpServer())
        .get(`/game/${gameId}/phase`)
        .expect(200);
      expect(themeRes.body).toEqual({
        phase: 'theme',
        roundId: secondRound.id,
      });

      // Pick theme on second round → transitions to song phase for second round
      await request(app.getHttpServer())
        .patch(`/round/${secondRound.id}`)
        .send({ theme: 'Jazz', userId: secondRound.themeMasterId, pin })
        .expect(200);

      const songRes = await request(app.getHttpServer())
        .get(`/game/${gameId}/phase`)
        .expect(200);
      expect(songRes.body).toEqual({ phase: 'song', roundId: secondRound.id });
    });
  });

  describe('WebSocket state change events', () => {
    it('should emit room:stateChanged when a user joins', async () => {
      const pin = await createRoomWithUsers('host-ws-1', 'Host');

      const wsClient: ClientSocket = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve) => wsClient.on('connect', resolve));
      wsClient.emit('room:subscribe', { pin, userId: 'host-ws-1' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stateChangedPromise = new Promise<void>((resolve) => {
        wsClient.on('room:stateChanged', () => resolve());
      });

      await request(app.getHttpServer())
        .patch(`/room/${pin}`)
        .send({ id: 'guest-ws-1', name: 'Guest' })
        .expect(200);

      await expect(
        Promise.race([
          stateChangedPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000),
          ),
        ]),
      ).resolves.toBeUndefined();

      wsClient.disconnect();
    });

    it('should emit room:stateChanged when a game starts', async () => {
      const pin = await createRoomWithUsers('host-ws-2', 'Host', [
        { id: 'guest-ws-2', name: 'Guest' },
      ]);

      const wsClient: ClientSocket = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve) => wsClient.on('connect', resolve));
      wsClient.emit('room:subscribe', { pin, userId: 'host-ws-2' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stateChangedPromise = new Promise<void>((resolve) => {
        wsClient.on('room:stateChanged', () => resolve());
      });

      await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      await expect(
        Promise.race([
          stateChangedPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000),
          ),
        ]),
      ).resolves.toBeUndefined();

      wsClient.disconnect();
    });

    it('should emit game:stateChanged when theme is picked', async () => {
      const pin = await createRoomWithUsers('host-ws-3', 'Host', [
        { id: 'guest-ws-3', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const roundId = gameRes.body.roundId;
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      const wsClient: ClientSocket = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve) => wsClient.on('connect', resolve));
      wsClient.emit('room:subscribe', { pin, userId: 'host-ws-3' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stateChangedPromise = new Promise<void>((resolve) => {
        wsClient.on('game:stateChanged', () => resolve());
      });

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ theme: 'Electronic', userId: round.themeMasterId, pin })
        .expect(200);

      await expect(
        Promise.race([
          stateChangedPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000),
          ),
        ]),
      ).resolves.toBeUndefined();

      wsClient.disconnect();
    });

    it('should emit game:stateChanged when a song is picked', async () => {
      const pin = await createRoomWithUsers('host-ws-4', 'Host', [
        { id: 'guest-ws-4', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const roundId = gameRes.body.roundId;
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      // Pick theme first
      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ theme: 'Hip-Hop', userId: round.themeMasterId, pin })
        .expect(200);

      const wsClient: ClientSocket = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve) => wsClient.on('connect', resolve));
      wsClient.emit('room:subscribe', { pin, userId: 'host-ws-4' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stateChangedPromise = new Promise<void>((resolve) => {
        wsClient.on('game:stateChanged', () => resolve());
      });

      await request(app.getHttpServer())
        .post(`/pick?pin=${pin}`)
        .send({
          roundId,
          userId: 'host-ws-4',
          track: {
            id: 'track-ws-4',
            title: 'Test Song',
            artist: 'Test Artist',
            album: 'Test Album',
            cover: 'https://example.com/c.jpg',
            previewUrl: 'https://example.com/p.mp3',
          },
        })
        .expect(201);

      await expect(
        Promise.race([
          stateChangedPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000),
          ),
        ]),
      ).resolves.toBeUndefined();

      wsClient.disconnect();
    });
  });
});
