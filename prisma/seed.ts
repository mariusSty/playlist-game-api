import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const themes = [
  'Rock',
  'Pop',
  'Rap',
  'Country',
  'Jazz',
  'Classical',
  'Electronic',
  'Blues',
];

const steps = [
  'Choose a theme',
  'Pick a song',
  'Guess who picked the song',
  'Last chance to change your mind',
  'Reveal the song picker',
  'See the results',
];

async function main() {
  for (const theme of themes) {
    await prisma.theme.create({
      data: {
        description: theme,
      },
    });
  }

  for (const step of steps) {
    await prisma.step.create({
      data: {
        name: step,
      },
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
