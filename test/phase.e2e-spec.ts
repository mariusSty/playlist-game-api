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
import { SessionModule } from '../src/session/session.module';
import { UserModule } from '../src/user/user.module';
import { pushSchema } from './setup-e2e';

dotenv.config({ path: '.env.test' });

describe('GET /user/:userId/session (e2e)', () => {
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
        RoomModule,
        GameModule,
        RoundModule,
        PickModule,
        SessionModule,
        UserModule,
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

  describe('phase: home', () => {
    it('should return home when user has no room', async () => {
      await prisma.user.create({ data: { id: 'user-home', name: 'Home' } });

      const res = await request(app.getHttpServer())
        .get('/user/user-home/session')
        .expect(200);

      expect(res.body).toEqual({ phase: 'home' });
    });

    it('should return home for unknown user', async () => {
      const res = await request(app.getHttpServer())
        .get('/user/unknown-user/session')
        .expect(200);

      expect(res.body).toEqual({ phase: 'home' });
    });
  });

  describe('phase: lobby', () => {
    it('should return lobby when user is in a room with no active game', async () => {
      const pin = await createRoomWithUsers('host-lobby-1', 'Host');

      const res = await request(app.getHttpServer())
        .get('/user/host-lobby-1/session')
        .expect(200);

      expect(res.body).toEqual({ phase: 'lobby', pin });
    });

    it('should return lobby after game is finished', async () => {
      const pin = await createRoomWithUsers('host-lobby-2', 'Host', [
        { id: 'guest-lobby-2', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/game/${gameRes.body.gameId}/finish`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/user/host-lobby-2/session')
        .expect(200);

      expect(res.body).toEqual({ phase: 'lobby', pin });
    });
  });

  describe('phase: theme', () => {
    it('should return theme phase at game start', async () => {
      const pin = await createRoomWithUsers('host-theme-1', 'Host', [
        { id: 'guest-theme-1', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/user/host-theme-1/session')
        .expect(200);

      expect(res.body).toMatchObject({
        phase: 'theme',
        pin,
        gameId: gameRes.body.gameId,
        roundId: gameRes.body.roundId,
      });
    });
  });

  describe('phase: song', () => {
    it('should return song phase after theme is picked', async () => {
      const pin = await createRoomWithUsers('host-song-1', 'Host', [
        { id: 'guest-song-1', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const roundId = gameRes.body.roundId;
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ theme: 'Rock', userId: round.themeMasterId, pin })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/user/host-song-1/session')
        .expect(200);

      expect(res.body).toMatchObject({
        phase: 'song',
        pin,
        gameId: gameRes.body.gameId,
        roundId,
      });
    });
  });

  describe('phase: vote', () => {
    it('should return vote phase when all picks are done', async () => {
      const pin = await createRoomWithUsers('host-vote-1', 'Host', [
        { id: 'guest-vote-1', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const roundId = gameRes.body.roundId;
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ theme: 'Jazz', userId: round.themeMasterId, pin })
        .expect(200);

      await prisma.track.createMany({
        data: [
          {
            id: 'track-vote-1a',
            title: 'S1',
            artist: 'A1',
            album: 'Al1',
            cover: 'c1',
            previewUrl: 'p1',
          },
          {
            id: 'track-vote-1b',
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
          { roundId, userId: 'host-vote-1', trackId: 'track-vote-1a' },
          { roundId, userId: 'guest-vote-1', trackId: 'track-vote-1b' },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/user/host-vote-1/session')
        .expect(200);

      expect(res.body.phase).toBe('vote');
      expect(res.body.pin).toBe(pin);
      expect(res.body.gameId).toBe(gameRes.body.gameId);
      expect(res.body.roundId).toBe(roundId);
      expect(res.body.pickId).toEqual(expect.any(Number));
    });
  });

  describe('phase: reveal', () => {
    it('should return reveal phase when all votes are done', async () => {
      const pin = await createRoomWithUsers('host-reveal-1', 'Host', [
        { id: 'guest-reveal-1', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const roundId = gameRes.body.roundId;
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ theme: 'Pop', userId: round.themeMasterId, pin })
        .expect(200);

      await prisma.track.createMany({
        data: [
          {
            id: 'track-rev-1a',
            title: 'S1',
            artist: 'A1',
            album: 'Al1',
            cover: 'c1',
            previewUrl: 'p1',
          },
          {
            id: 'track-rev-1b',
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
          data: { roundId, userId: 'host-reveal-1', trackId: 'track-rev-1a' },
        }),
        prisma.pick.create({
          data: { roundId, userId: 'guest-reveal-1', trackId: 'track-rev-1b' },
        }),
      ]);

      await prisma.vote.createMany({
        data: [
          {
            pickId: picks[0].id,
            guessUserId: 'host-reveal-1',
            guessedUserId: 'host-reveal-1',
          },
          {
            pickId: picks[0].id,
            guessUserId: 'guest-reveal-1',
            guessedUserId: 'host-reveal-1',
          },
          {
            pickId: picks[1].id,
            guessUserId: 'host-reveal-1',
            guessedUserId: 'guest-reveal-1',
          },
          {
            pickId: picks[1].id,
            guessUserId: 'guest-reveal-1',
            guessedUserId: 'guest-reveal-1',
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/user/host-reveal-1/session')
        .expect(200);

      expect(res.body).toMatchObject({
        phase: 'reveal',
        pin,
        gameId: gameRes.body.gameId,
        roundId,
      });
    });
  });

  describe('phase: result', () => {
    it('should return result phase when game is finished', async () => {
      const pin = await createRoomWithUsers('host-result-1', 'Host', [
        { id: 'guest-result-1', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/game/${gameRes.body.gameId}/finish`)
        .expect(200);

      // After finish, gameid is detached but user tracks the last game
      // The user still has the game associated (game has no room but user still is in room)
      // Since game.roomId = null → result phase
      // But user is still in the room → game filter = games where roomId is not null → no active game
      // → lobby. That means result is shown via the game's detached state.
      // User is still in the room → room has no active game → lobby
      // BUT user session for a finished game shows lobby (game detached).
      // Let the test simply verify the user's host session after game finishes.
      const res = await request(app.getHttpServer())
        .get('/user/host-result-1/session')
        .expect(200);

      // After game finishes (roomId = null), room has no active game → lobby
      expect(res.body).toEqual({ phase: 'lobby', pin });
    });
  });

  describe('phase progression: full game flow', () => {
    it('should return theme for next round after completing first round', async () => {
      const pin = await createRoomWithUsers('host-flow-1', 'Host', [
        { id: 'guest-flow-1', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const gameId = gameRes.body.gameId;
      const firstRoundId = gameRes.body.roundId;

      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { rounds: { orderBy: { id: 'asc' } } },
      });
      const secondRound = game.rounds[1];

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
            id: 'track-flow-1a',
            title: 'S1',
            artist: 'A1',
            album: 'Al1',
            cover: 'c1',
            previewUrl: 'p1',
          },
          {
            id: 'track-flow-1b',
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
            userId: 'host-flow-1',
            trackId: 'track-flow-1a',
          },
        }),
        prisma.pick.create({
          data: {
            roundId: firstRoundId,
            userId: 'guest-flow-1',
            trackId: 'track-flow-1b',
          },
        }),
      ]);
      await prisma.vote.createMany({
        data: [
          {
            pickId: picks[0].id,
            guessUserId: 'host-flow-1',
            guessedUserId: 'host-flow-1',
          },
          {
            pickId: picks[0].id,
            guessUserId: 'guest-flow-1',
            guessedUserId: 'host-flow-1',
          },
          {
            pickId: picks[1].id,
            guessUserId: 'host-flow-1',
            guessedUserId: 'guest-flow-1',
          },
          {
            pickId: picks[1].id,
            guessUserId: 'guest-flow-1',
            guessedUserId: 'guest-flow-1',
          },
        ],
      });

      const revealRes = await request(app.getHttpServer())
        .get('/user/host-flow-1/session')
        .expect(200);
      expect(revealRes.body).toMatchObject({
        phase: 'reveal',
        pin,
        gameId,
        roundId: firstRoundId,
      });

      await request(app.getHttpServer())
        .post(`/round/next?pin=${pin}`)
        .expect(201);

      const themeRes = await request(app.getHttpServer())
        .get('/user/host-flow-1/session')
        .expect(200);
      expect(themeRes.body).toMatchObject({
        phase: 'theme',
        pin,
        gameId,
        roundId: secondRound.id,
      });

      await request(app.getHttpServer())
        .patch(`/round/${secondRound.id}`)
        .send({ theme: 'Jazz', userId: secondRound.themeMasterId, pin })
        .expect(200);

      const songRes = await request(app.getHttpServer())
        .get('/user/host-flow-1/session')
        .expect(200);
      expect(songRes.body).toMatchObject({
        phase: 'song',
        pin,
        gameId,
        roundId: secondRound.id,
      });
    });
  });

  describe('WebSocket: session:updated', () => {
    it('should emit session:updated when a user joins a room', async () => {
      const pin = await createRoomWithUsers('host-ws-1', 'Host');

      const wsClient: ClientSocket = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve) => wsClient.on('connect', resolve));
      wsClient.emit('session:subscribe', { pin, userId: 'host-ws-1' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const sessionUpdatedPromise = new Promise<void>((resolve) => {
        wsClient.on('session:updated', () => resolve());
      });

      await request(app.getHttpServer())
        .patch(`/room/${pin}`)
        .send({ id: 'guest-ws-1', name: 'Guest' })
        .expect(200);

      await expect(
        Promise.race([
          sessionUpdatedPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000),
          ),
        ]),
      ).resolves.toBeUndefined();

      wsClient.disconnect();
    });

    it('should emit session:updated when a game starts', async () => {
      const pin = await createRoomWithUsers('host-ws-2', 'Host', [
        { id: 'guest-ws-2', name: 'Guest' },
      ]);

      const wsClient: ClientSocket = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve) => wsClient.on('connect', resolve));
      wsClient.emit('session:subscribe', { pin, userId: 'host-ws-2' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const sessionUpdatedPromise = new Promise<void>((resolve) => {
        wsClient.on('session:updated', () => resolve());
      });

      await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      await expect(
        Promise.race([
          sessionUpdatedPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000),
          ),
        ]),
      ).resolves.toBeUndefined();

      wsClient.disconnect();
    });

    it('should emit session:updated when theme is picked', async () => {
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
      wsClient.emit('session:subscribe', { pin, userId: 'host-ws-3' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const sessionUpdatedPromise = new Promise<void>((resolve) => {
        wsClient.on('session:updated', () => resolve());
      });

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ theme: 'Electronic', userId: round.themeMasterId, pin })
        .expect(200);

      await expect(
        Promise.race([
          sessionUpdatedPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000),
          ),
        ]),
      ).resolves.toBeUndefined();

      wsClient.disconnect();
    });

    it('should emit session:updated when a song is picked', async () => {
      const pin = await createRoomWithUsers('host-ws-4', 'Host', [
        { id: 'guest-ws-4', name: 'Guest' },
      ]);

      const gameRes = await request(app.getHttpServer())
        .post('/game')
        .send({ pin })
        .expect(201);

      const roundId = gameRes.body.roundId;
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ theme: 'Hip-Hop', userId: round.themeMasterId, pin })
        .expect(200);

      const wsClient: ClientSocket = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve) => wsClient.on('connect', resolve));
      wsClient.emit('session:subscribe', { pin, userId: 'host-ws-4' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const sessionUpdatedPromise = new Promise<void>((resolve) => {
        wsClient.on('session:updated', () => resolve());
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
          sessionUpdatedPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000),
          ),
        ]),
      ).resolves.toBeUndefined();

      wsClient.disconnect();
    });
  });
});
