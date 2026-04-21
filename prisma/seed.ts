import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate());

async function main() {
  const themeKeys = [
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

  for (const key of themeKeys) {
    await prisma.theme.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
