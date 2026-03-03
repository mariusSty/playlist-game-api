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

    // Strip `cacheStrategy` (Accelerate-only) so queries work against a direct DB
    const testClient = prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const { cacheStrategy, ...rest } = args as any;
            return query(rest);
          },
        },
      },
    });

    // Build the NestJS app, overriding PrismaService with the test client
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, RoomModule],
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

    it('should connect a new user to an existing room and emit room:updated', async () => {
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
      wsClient.emit('room:subscribe', { pin, userId: 'host-1' });

      // Wait for the subscribe to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Set up listener for the room:updated event
      const userListPromise = new Promise<any>((resolve) => {
        wsClient.on('room:updated', (data) => {
          if (data.users?.length === 2) {
            resolve(data);
          }
        });
      });

      // Connect a second user via PATCH
      await request(app.getHttpServer())
        .patch(`/room/${pin}`)
        .send({ id: 'guest-1', name: 'Guest' })
        .expect(200);

      // Verify WebSocket event was emitted
      const wsData = await userListPromise;
      expect(wsData.pin).toBe(pin);
      expect(wsData.hostId).toBe('host-1');
      expect(wsData.users).toHaveLength(2);

      // Verify both users are in the room in DB
      const room = await prisma.room.findUnique({
        where: { pin },
        include: { users: true },
      });
      expect(room.users).toHaveLength(2);
      const userIds = room.users.map((u) => u.id).sort();
      expect(userIds).toEqual(['guest-1', 'host-1']);
    });

    it('should reject room:subscribe for a user not in the room', async () => {
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
      wsClient.emit('room:subscribe', { pin, userId: 'stranger' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The stranger should NOT receive room:updated when a guest joins
      let received = false;
      wsClient.on('room:updated', () => {
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

    it('should disconnect a user and emit room:updated', async () => {
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
      wsClient.emit('room:subscribe', { pin, userId: 'host-leave' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Listen for userList after the leave
      const userListPromise = new Promise<any>((resolve) => {
        wsClient.on('room:updated', (data) => {
          if (data.users?.length === 1) resolve(data);
        });
      });

      // Guest leaves
      const response = await request(app.getHttpServer())
        .delete(`/room/${pin}/users/guest-leave`)
        .expect(200);

      expect(response.body.hostId).toBe('host-leave');
      expect(response.body.users).toHaveLength(1);

      // Verify WebSocket event
      const wsData = await userListPromise;
      expect(wsData.pin).toBe(pin);
      expect(wsData.users).toHaveLength(1);
      expect(wsData.hostId).toBe('host-leave');
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
  });
});
