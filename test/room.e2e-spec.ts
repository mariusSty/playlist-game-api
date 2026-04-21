import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { Socket as ClientSocket, io } from 'socket.io-client';
import request from 'supertest';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaModule } from '../src/prisma.module';
import { PrismaService } from '../src/prisma.service';
import { RoomModule } from '../src/room/room.module';
import { SessionModule } from '../src/session/session.module';
import { pushSchema } from './setup-e2e';

dotenv.config({ path: '.env.test' });

describe('RoomController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let wsPort: number;

  beforeAll(async () => {
    // Sync test database schema
    pushSchema();

    // Create a PrismaClient using the pg adapter for direct DB access
    const adapter = new PrismaPg({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    // Build the NestJS app, overriding PrismaService with the test client
    const testClient = prisma;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, SessionModule, RoomModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        client: testClient,
        onModuleInit: () => Promise.resolve(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Start the HTTP server once and capture the port for WebSocket tests
    const address = app.getHttpServer().listen().address();
    wsPort = typeof address === 'string' ? 0 : (address as any).port;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  afterEach(async () => {
    // Clean all tables between tests (order matters for FK constraints)
    await prisma.vote.deleteMany();
    await prisma.pick.deleteMany();
    await prisma.round.deleteMany();
    await prisma.game.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /room', () => {
    it('should create a new room and return it', async () => {
      const response = await request(app.getHttpServer())
        .post('/room')
        .send({ id: 'user-1', name: 'Alice' })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        pin: expect.stringMatching(/^\d{6}$/),
        hostId: 'user-1',
      });

      // Verify user was persisted
      const user = await prisma.user.findUnique({ where: { id: 'user-1' } });
      expect(user).not.toBeNull();
      expect(user.name).toBe('Alice');
    });

    it('should return the existing room if user is already a host', async () => {
      // First creation
      const first = await request(app.getHttpServer())
        .post('/room')
        .send({ id: 'user-2', name: 'Bob' })
        .expect(201);

      // Second call with same user → returns the existing room
      const second = await request(app.getHttpServer())
        .post('/room')
        .send({ id: 'user-2', name: 'Bob' })
        .expect(201);

      expect(second.body.pin).toBe(first.body.pin);
      expect(second.body.hostId).toBe('user-2');

      // Only one room should exist
      const rooms = await prisma.room.findMany();
      expect(rooms).toHaveLength(1);
    });

    it('should upsert an existing user name', async () => {
      // Create user first time
      await request(app.getHttpServer())
        .post('/room')
        .send({ id: 'user-3', name: 'OldName' })
        .expect(201);

      // Delete the room so the user can create a new one
      await prisma.room.deleteMany();

      await request(app.getHttpServer())
        .post('/room')
        .send({ id: 'user-3', name: 'NewName' })
        .expect(201);

      const user = await prisma.user.findUnique({ where: { id: 'user-3' } });
      expect(user.name).toBe('NewName');
    });
  });

  describe('GET /room/:pin', () => {
    it('should return a room with host and users by pin', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/room')
        .send({ id: 'user-10', name: 'Grace' })
        .expect(201);

      const pin = createRes.body.pin;

      const response = await request(app.getHttpServer())
        .get(`/room/${pin}`)
        .expect(200);

      expect(response.body).toMatchObject({
        pin,
        hostId: 'user-10',
      });
      expect(response.body.host).toMatchObject({
        id: 'user-10',
        name: 'Grace',
      });
      expect(response.body.users).toBeInstanceOf(Array);
      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0].id).toBe('user-10');
    });

    it('should return null for a non-existent pin', async () => {
      const response = await request(app.getHttpServer())
        .get('/room/000000')
        .expect(200);

      expect(response.body).toEqual({});
    });
  });

  describe('PATCH /room/:pin', () => {
    let wsClient: ClientSocket;

    afterEach(() => {
      if (wsClient?.connected) {
        wsClient.disconnect();
      }
    });

    it('should connect a new user to an existing room and emit session:updated', async () => {
      // Create a room
      const createRes = await request(app.getHttpServer())
        .post('/room')
        .send({ id: 'host-1', name: 'Host' })
        .expect(201);

      const pin = createRes.body.pin;

      // Connect a WebSocket client and subscribe to the room
      wsClient = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await new Promise<void>((resolve) => wsClient.on('connect', resolve));

      // Subscribe — host is a member, so it should be accepted
      wsClient.emit('session:subscribe', { pin, userId: 'host-1' });

      // Wait for the subscribe to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Set up listener for the session:updated signal
      const signalPromise = new Promise<void>((resolve) => {
        wsClient.on('session:updated', resolve);
      });

      // Connect a second user via PATCH
      await request(app.getHttpServer())
        .patch(`/room/${pin}`)
        .send({ id: 'guest-1', name: 'Guest' })
        .expect(200);

      // Verify WebSocket signal was received
      await signalPromise;

      // Re-fetch room state via HTTP to verify
      const roomRes = await request(app.getHttpServer())
        .get(`/room/${pin}`)
        .expect(200);
      expect(roomRes.body.pin).toBe(pin);
      expect(roomRes.body.hostId).toBe('host-1');
      expect(roomRes.body.users).toHaveLength(2);

      // Verify both users are in the room in DB
      const room = await prisma.room.findUnique({
        where: { pin },
        include: { users: true },
      });
      expect(room.users).toHaveLength(2);
      const userIds = room.users.map((u) => u.id).sort();
      expect(userIds).toEqual(['guest-1', 'host-1']);
    });

    it('should reject session:subscribe for a user not in the room', async () => {
      // Create a room
      const createRes = await request(app.getHttpServer())
        .post('/room')
        .send({ id: 'host-reject', name: 'Host' })
        .expect(201);
      const pin = createRes.body.pin;

      // Connect a WS client as a stranger (not a member)
      wsClient = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve) => wsClient.on('connect', resolve));

      // Try to subscribe with a userId that is NOT in the room
      wsClient.emit('session:subscribe', { pin, userId: 'stranger' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The stranger should NOT receive session:updated when a guest joins
      let received = false;
      wsClient.on('session:updated', () => {
        received = true;
      });

      await request(app.getHttpServer())
        .patch(`/room/${pin}`)
        .send({ id: 'guest-reject', name: 'Guest' })
        .expect(200);

      // Give some time for a potential event
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(received).toBe(false);
    });

    it('should return 404 for a non-existent room pin', async () => {
      await request(app.getHttpServer())
        .patch('/room/999999')
        .send({ id: 'guest-2', name: 'Nobody' })
        .expect(404);
    });
  });

  describe('DELETE /room/:pin/users/:userId', () => {
    let wsClient: ClientSocket;

    afterEach(() => {
      if (wsClient?.connected) {
        wsClient.disconnect();
      }
    });

    it('should disconnect a user and emit session:updated', async () => {
      // Create a room with a host
      const createRes = await request(app.getHttpServer())
        .post('/room')
        .send({ id: 'host-leave', name: 'Host' })
        .expect(201);
      const pin = createRes.body.pin;

      // Add a second user
      await request(app.getHttpServer())
        .patch(`/room/${pin}`)
        .send({ id: 'guest-leave', name: 'Guest' })
        .expect(200);

      // Subscribe to the room via WebSocket (host is a member)
      wsClient = io(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve) => wsClient.on('connect', resolve));
      wsClient.emit('session:subscribe', { pin, userId: 'host-leave' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Listen for session:updated signal after the leave
      const signalPromise = new Promise<void>((resolve) => {
        wsClient.on('session:updated', resolve);
      });

      // Guest leaves
      const response = await request(app.getHttpServer())
        .delete(`/room/${pin}/users/guest-leave`)
        .expect(200);

      expect(response.body.hostId).toBe('host-leave');
      expect(response.body.users).toHaveLength(1);

      // Verify WebSocket signal was received
      await signalPromise;

      // Re-fetch room state to confirm
      const roomRes = await request(app.getHttpServer())
        .get(`/room/${pin}`)
        .expect(200);
      expect(roomRes.body.pin).toBe(pin);
      expect(roomRes.body.users).toHaveLength(1);
      expect(roomRes.body.hostId).toBe('host-leave');
    });

    it('should transfer host when the host leaves', async () => {
      // Create a room
      const createRes = await request(app.getHttpServer())
        .post('/room')
        .send({ id: 'host-transfer', name: 'Host' })
        .expect(201);
      const pin = createRes.body.pin;

      // Add a second user
      await request(app.getHttpServer())
        .patch(`/room/${pin}`)
        .send({ id: 'guest-transfer', name: 'Guest' })
        .expect(200);

      // Host leaves
      const response = await request(app.getHttpServer())
        .delete(`/room/${pin}/users/host-transfer`)
        .expect(200);

      expect(response.body.hostId).toBe('guest-transfer');
      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0].id).toBe('guest-transfer');
    });

    it('should delete the room when the last user leaves', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/room')
        .send({ id: 'solo-user', name: 'Solo' })
        .expect(201);
      const pin = createRes.body.pin;

      const response = await request(app.getHttpServer())
        .delete(`/room/${pin}/users/solo-user`)
        .expect(200);

      expect(response.body.deleted).toBe(true);

      // Verify room no longer exists
      const room = await prisma.room.findUnique({ where: { pin } });
      expect(room).toBeNull();
    });

    it('should return 404 for a non-existent room', async () => {
      await request(app.getHttpServer())
        .delete('/room/000000/users/nobody')
        .expect(404);
    });

    describe('during an active game', () => {
      it("should delete the leaving guest's unthemed round from the game", async () => {
        const createRes = await request(app.getHttpServer())
          .post('/room')
          .send({ id: 'hg-leave-1', name: 'Host' })
          .expect(201);
        const pin = createRes.body.pin;
        await request(app.getHttpServer())
          .patch(`/room/${pin}`)
          .send({ id: 'gg-leave-1', name: 'Guest' })
          .expect(200);
        const gameRes = await request(app.getHttpServer())
          .post('/game')
          .send({ pin })
          .expect(201);
        const gameId = gameRes.body.gameId;

        const gameBefore = await prisma.game.findUnique({
          where: { id: gameId },
          include: { rounds: true, users: true },
        });
        expect(gameBefore.rounds).toHaveLength(2);
        expect(gameBefore.users).toHaveLength(2);

        await request(app.getHttpServer())
          .delete(`/room/${pin}/users/gg-leave-1`)
          .expect(200);

        const gameAfter = await prisma.game.findUnique({
          where: { id: gameId },
          include: { rounds: true, users: true },
        });
        // Guest's unthemed round is deleted
        expect(gameAfter.rounds).toHaveLength(1);
        expect(gameAfter.rounds[0].themeMasterId).toBe('hg-leave-1');
        // Guest removed from game users
        expect(gameAfter.users.map((u) => u.id)).not.toContain('gg-leave-1');
        // Guest removed from room
        const room = await prisma.room.findUnique({
          where: { pin },
          include: { users: true },
        });
        expect(room.users.map((u) => u.id)).not.toContain('gg-leave-1');
      });

      it("should delete the leaving user's pick when leaving during song phase", async () => {
        const createRes = await request(app.getHttpServer())
          .post('/room')
          .send({ id: 'hg-leave-2', name: 'Host' })
          .expect(201);
        const pin = createRes.body.pin;
        await request(app.getHttpServer())
          .patch(`/room/${pin}`)
          .send({ id: 'gg-leave-2', name: 'Guest' })
          .expect(200);
        const gameRes = await request(app.getHttpServer())
          .post('/game')
          .send({ pin })
          .expect(201);
        const gameId = gameRes.body.gameId;
        const firstRoundId = gameRes.body.roundId;

        // Set theme directly in DB to move to song phase
        await prisma.round.update({
          where: { id: Number(firstRoundId) },
          data: { customTheme: 'Rock' },
        });

        // Guest submits a pick
        await prisma.track.create({
          data: {
            id: 'track-gleave-2',
            title: 'Song',
            artist: 'Artist',
            album: 'Album',
            cover: 'cover',
            previewUrl: 'preview',
          },
        });
        await prisma.pick.create({
          data: {
            roundId: Number(firstRoundId),
            userId: 'gg-leave-2',
            trackId: 'track-gleave-2',
            position: 0,
          },
        });

        const picksBefore = await prisma.pick.findMany({
          where: { roundId: firstRoundId },
        });
        expect(picksBefore).toHaveLength(1);

        await request(app.getHttpServer())
          .delete(`/room/${pin}/users/gg-leave-2`)
          .expect(200);

        // Guest's pick is deleted
        const picksAfter = await prisma.pick.findMany({
          where: { roundId: firstRoundId },
        });
        expect(picksAfter).toHaveLength(0);

        const gameAfter = await prisma.game.findUnique({
          where: { id: gameId },
          include: { users: true },
        });
        expect(gameAfter.users.map((u) => u.id)).toEqual(['hg-leave-2']);
      });

      it('should clean up picks and votes when leaving during vote phase', async () => {
        const createRes = await request(app.getHttpServer())
          .post('/room')
          .send({ id: 'hg-leave-3', name: 'Host' })
          .expect(201);
        const pin = createRes.body.pin;
        await request(app.getHttpServer())
          .patch(`/room/${pin}`)
          .send({ id: 'gg-leave-3', name: 'Guest' })
          .expect(200);
        const gameRes = await request(app.getHttpServer())
          .post('/game')
          .send({ pin })
          .expect(201);
        const firstRoundId = gameRes.body.roundId;

        // Set theme directly in DB
        await prisma.round.update({
          where: { id: Number(firstRoundId) },
          data: { customTheme: 'Jazz' },
        });

        await prisma.track.createMany({
          data: [
            {
              id: 'track-gleave-3a',
              title: 'S1',
              artist: 'A1',
              album: 'Al1',
              cover: 'c1',
              previewUrl: 'p1',
            },
            {
              id: 'track-gleave-3b',
              title: 'S2',
              artist: 'A2',
              album: 'Al2',
              cover: 'c2',
              previewUrl: 'p2',
            },
          ],
        });
        const hostPick = await prisma.pick.create({
          data: {
            roundId: Number(firstRoundId),
            userId: 'hg-leave-3',
            trackId: 'track-gleave-3a',
            position: 0,
          },
        });
        const guestPick = await prisma.pick.create({
          data: {
            roundId: Number(firstRoundId),
            userId: 'gg-leave-3',
            trackId: 'track-gleave-3b',
            position: 0,
          },
        });

        // Host votes on guest's pick; guest votes on host's pick
        await prisma.vote.create({
          data: {
            pickId: guestPick.id,
            guessUserId: 'hg-leave-3',
            guessedUserId: 'gg-leave-3',
          },
        });
        await prisma.vote.create({
          data: {
            pickId: hostPick.id,
            guessUserId: 'gg-leave-3',
            guessedUserId: 'hg-leave-3',
          },
        });

        await request(app.getHttpServer())
          .delete(`/room/${pin}/users/gg-leave-3`)
          .expect(200);

        // Guest's pick is deleted
        const guestPickAfter = await prisma.pick.findUnique({
          where: { id: guestPick.id },
        });
        expect(guestPickAfter).toBeNull();

        // Votes ON guest's pick are deleted
        const votesOnGuestPick = await prisma.vote.findMany({
          where: { pickId: guestPick.id },
        });
        expect(votesOnGuestPick).toHaveLength(0);

        // Votes BY guest are deleted
        const votesByGuest = await prisma.vote.findMany({
          where: { guessUserId: 'gg-leave-3' },
        });
        expect(votesByGuest).toHaveLength(0);

        // Host's pick is preserved
        const hostPickAfter = await prisma.pick.findUnique({
          where: { id: hostPick.id },
        });
        expect(hostPickAfter).not.toBeNull();
      });

      it('should transfer host and clean up game data when host leaves during active game', async () => {
        const createRes = await request(app.getHttpServer())
          .post('/room')
          .send({ id: 'hg-leave-4', name: 'Host' })
          .expect(201);
        const pin = createRes.body.pin;
        await request(app.getHttpServer())
          .patch(`/room/${pin}`)
          .send({ id: 'gg-leave-4', name: 'Guest' })
          .expect(200);
        const gameRes = await request(app.getHttpServer())
          .post('/game')
          .send({ pin })
          .expect(201);
        const gameId = gameRes.body.gameId;

        const response = await request(app.getHttpServer())
          .delete(`/room/${pin}/users/hg-leave-4`)
          .expect(200);

        // Host role transferred to guest
        expect(response.body.hostId).toBe('gg-leave-4');
        expect(response.body.users).toHaveLength(1);
        expect(response.body.users[0].id).toBe('gg-leave-4');

        // Host's unthemed round is deleted from the game
        const gameAfter = await prisma.game.findUnique({
          where: { id: gameId },
          include: { rounds: true, users: true },
        });
        expect(gameAfter.rounds).toHaveLength(1);
        expect(gameAfter.rounds[0].themeMasterId).toBe('gg-leave-4');
        expect(gameAfter.users.map((u) => u.id)).toEqual(['gg-leave-4']);
      });
    });
  });
});
