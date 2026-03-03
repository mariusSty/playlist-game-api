import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
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
    it('should connect a new user to an existing room', async () => {
      // Create a room
      const createRes = await request(app.getHttpServer())
        .post('/room')
        .send({ id: 'host-1', name: 'Host' })
        .expect(201);

      const pin = createRes.body.pin;

      // Connect a second user
      await request(app.getHttpServer())
        .patch(`/room/${pin}`)
        .send({ id: 'guest-1', name: 'Guest' })
        .expect(200);

      // Verify both users are in the room
      const room = await prisma.room.findUnique({
        where: { pin },
        include: { users: true },
      });
      expect(room.users).toHaveLength(2);
      const userIds = room.users.map((u) => u.id).sort();
      expect(userIds).toEqual(['guest-1', 'host-1']);
    });

    it('should return 404 for a non-existent room pin', async () => {
      await request(app.getHttpServer())
        .patch('/room/999999')
        .send({ id: 'guest-2', name: 'Nobody' })
        .expect(404);
    });
  });
});
