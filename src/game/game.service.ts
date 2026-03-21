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

  findActiveByRoomPin(pin: string) {
    return this.prisma.client.game.findFirst({
      where: {
        room: { pin },
        roomId: { not: null },
      },
      include: { users: true },
    });
  }

  async removeUser(gameId: number, userId: string) {
    await this.prisma.client.$transaction(async (tx) => {
      // 1. Delete unthemed rounds where this user is theme master (no picks/votes exist yet)
      await tx.round.deleteMany({
        where: {
          gameId,
          themeMasterId: userId,
          theme: '',
        },
      });

      // 2. Find non-completed active rounds (themed, not yet revealed)
      const activeRounds = await tx.round.findMany({
        where: {
          gameId,
          theme: { not: '' },
          revealCompleted: false,
        },
        select: { id: true },
      });
      const activeRoundIds = activeRounds.map((r) => r.id);

      if (activeRoundIds.length > 0) {
        // Delete votes ON the leaving user's picks in active rounds
        await tx.vote.deleteMany({
          where: {
            pick: {
              userId,
              roundId: { in: activeRoundIds },
            },
          },
        });

        // Delete votes BY the leaving user in active rounds
        await tx.vote.deleteMany({
          where: {
            guessUserId: userId,
            pick: { roundId: { in: activeRoundIds } },
          },
        });

        // Delete the leaving user's picks in active rounds
        await tx.pick.deleteMany({
          where: {
            userId,
            roundId: { in: activeRoundIds },
          },
        });
      }

      // 3. Disconnect user from the game's users (m2m)
      await tx.game.update({
        where: { id: gameId },
        data: {
          users: { disconnect: { id: userId } },
        },
      });
    });
  }
}
