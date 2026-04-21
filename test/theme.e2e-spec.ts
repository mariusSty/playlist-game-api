import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import request from 'supertest';
import { GameModule } from '../src/game/game.module';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaModule } from '../src/prisma.module';
import { PrismaService } from '../src/prisma.service';
import { RoomModule } from '../src/room/room.module';
import { RoundModule } from '../src/round/round.module';
import { SessionModule } from '../src/session/session.module';
import { ThemeModule } from '../src/theme/theme.module';
import { UserModule } from '../src/user/user.module';
import { pushSchema } from './setup-e2e';

dotenv.config({ path: '.env.test' });

const BASE_THEME_KEYS = [
  'gultyPleasure',
  'sleepyTime',
  'partyTime',
  'sadness',
  'now',
  'roadTrip',
  'workout',
  'shower',
  'throwback',
  'karaoke',
  'cooking',
  'rainyDay',
  'summer',
  'funeral',
  'motivation',
  'loveStory',
  'sunrise',
  'chill',
  'danceFloor',
  'nostalgia',
];

describe('Theme (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

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
        SessionModule,
        ThemeModule,
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
    await prisma.theme.deleteMany();
  });

  async function seedBaseThemes() {
    for (const key of BASE_THEME_KEYS) {
      await prisma.theme.upsert({
        where: { key },
        update: {},
        create: { key },
      });
    }
  }

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
      gameId: gameRes.body.gameId as number,
      roundId: gameRes.body.roundId as number,
    };
  }

  describe('GET /theme', () => {
    it('should return all seeded base themes ordered by key', async () => {
      await seedBaseThemes();

      const res = await request(app.getHttpServer())
        .get('/theme')
        .expect(200);

      expect(res.body).toHaveLength(BASE_THEME_KEYS.length);
      const keys = res.body.map((t: { key: string }) => t.key);
      expect(keys).toEqual([...BASE_THEME_KEYS].sort());
      for (const theme of res.body) {
        expect(theme).toEqual({
          id: expect.any(Number),
          key: expect.any(String),
        });
      }
    });

    it('should return empty array when no themes are seeded', async () => {
      const res = await request(app.getHttpServer())
        .get('/theme')
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('PATCH /round/:roundId with themeId', () => {
    it('should accept a valid themeId and set the relation', async () => {
      await seedBaseThemes();
      const rockTheme = await prisma.theme.findUniqueOrThrow({
        where: { key: 'partyTime' },
      });

      const { pin, roundId } = await createRoomAndGame('host-tid-1', 'Host', [
        { id: 'guest-tid-1', name: 'Guest' },
      ]);
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      const res = await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ themeId: rockTheme.id, userId: round.themeMasterId, pin })
        .expect(200);

      expect(res.body).toMatchObject({
        id: roundId,
        themeId: rockTheme.id,
        customTheme: null,
      });

      const updated = await prisma.round.findUnique({ where: { id: roundId } });
      expect(updated.themeId).toBe(rockTheme.id);
      expect(updated.customTheme).toBeNull();
    });
  });

  describe('PATCH /round/:roundId with customTheme', () => {
    it('should accept a custom theme string', async () => {
      const { pin, roundId } = await createRoomAndGame('host-ct-1', 'Host', [
        { id: 'guest-ct-1', name: 'Guest' },
      ]);
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      const res = await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({
          customTheme: 'My own theme',
          userId: round.themeMasterId,
          pin,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        id: roundId,
        themeId: null,
        customTheme: 'My own theme',
      });
    });

    it('should trim the custom theme string', async () => {
      const { pin, roundId } = await createRoomAndGame('host-ct-2', 'Host', [
        { id: 'guest-ct-2', name: 'Guest' },
      ]);
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({
          customTheme: '   Padded theme   ',
          userId: round.themeMasterId,
          pin,
        })
        .expect(200);

      const updated = await prisma.round.findUnique({ where: { id: roundId } });
      expect(updated.customTheme).toBe('Padded theme');
    });

    it('should reject customTheme longer than 100 characters', async () => {
      const { pin, roundId } = await createRoomAndGame('host-ct-3', 'Host', [
        { id: 'guest-ct-3', name: 'Guest' },
      ]);
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({
          customTheme: 'a'.repeat(101),
          userId: round.themeMasterId,
          pin,
        })
        .expect(400);
    });
  });

  describe('PATCH /round/:roundId validation', () => {
    it('should reject when both themeId and customTheme are provided', async () => {
      await seedBaseThemes();
      const theme = await prisma.theme.findUniqueOrThrow({
        where: { key: 'chill' },
      });

      const { pin, roundId } = await createRoomAndGame('host-val-1', 'Host', [
        { id: 'guest-val-1', name: 'Guest' },
      ]);
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({
          themeId: theme.id,
          customTheme: 'Also a custom theme',
          userId: round.themeMasterId,
          pin,
        })
        .expect(400);
    });

    it('should reject when neither themeId nor customTheme is provided', async () => {
      const { pin, roundId } = await createRoomAndGame('host-val-2', 'Host', [
        { id: 'guest-val-2', name: 'Guest' },
      ]);
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ userId: round.themeMasterId, pin })
        .expect(400);
    });

    it('should reject empty/whitespace-only customTheme (no themeId)', async () => {
      const { pin, roundId } = await createRoomAndGame('host-val-3', 'Host', [
        { id: 'guest-val-3', name: 'Guest' },
      ]);
      const round = await prisma.round.findUnique({ where: { id: roundId } });

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ customTheme: '   ', userId: round.themeMasterId, pin })
        .expect(400);
    });

    it('should reject when a non-themeMaster tries to pick', async () => {
      const { pin, roundId } = await createRoomAndGame('host-val-4', 'Host', [
        { id: 'guest-val-4', name: 'Guest' },
      ]);
      const round = await prisma.round.findUnique({ where: { id: roundId } });
      const nonMaster =
        round.themeMasterId === 'host-val-4' ? 'guest-val-4' : 'host-val-4';

      await request(app.getHttpServer())
        .patch(`/round/${roundId}`)
        .send({ customTheme: 'Hacked', userId: nonMaster, pin })
        .expect(403);
    });
  });
});
