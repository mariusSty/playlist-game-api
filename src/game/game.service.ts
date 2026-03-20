import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  findWithRoom(id: number) {
    return this.prisma.client.game.findFirstOrThrow({
      where: { id },
      include: { room: true },
    });
  }

  async create(pin: string, userIds: string[]) {
    return this.prisma.client.game.create({
      data: {
        room: {
          connect: {
            pin,
          },
        },
        rounds: {
          create: userIds.map((userId) => ({
            themeMasterId: userId,
            theme: '',
          })),
        },
        users: {
          connect: userIds.map((userId) => ({ id: userId })),
        },
      },
      include: {
        rounds: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.client.game.findFirstOrThrow({
      where: {
        id,
      },
      include: {
        users: true,
        rounds: {
          include: {
            themeMaster: true,
            picks: {
              include: {
                votes: true,
              },
            },
          },
        },
      },
    });
  }

  calculateResults(game: Awaited<ReturnType<GameService['findOne']>>) {
    const scoreMap = new Map<
      string,
      { user: (typeof game.users)[number]; score: number }
    >();

    for (const user of game.users) {
      scoreMap.set(user.id, { user, score: 0 });
    }

    for (const round of game.rounds) {
      for (const pick of round.picks) {
        for (const vote of pick.votes) {
          if (vote.guessedUserId === pick.userId) {
            const entry = scoreMap.get(vote.guessUserId);
            if (entry) entry.score++;
          }
        }
      }
    }

    return [...scoreMap.values()];
  }

  detachRoom(id: number) {
    return this.prisma.client.game.update({
      data: {
        roomId: null,
      },
      where: {
        id,
      },
    });
  }
}
