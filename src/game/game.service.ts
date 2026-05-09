import { Injectable, NotFoundException } from '@nestjs/common';
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

  /**
   * Standard competition ranking (1224): users with equal scores share the
   * same place; the next place skips accordingly.
   */
  private assignPlaces(
    scores: Map<string, number>,
    userIds: string[],
  ): Map<string, number> {
    const sorted = [...userIds].sort((a, b) => {
      const diff = (scores.get(b) ?? 0) - (scores.get(a) ?? 0);
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });
    const places = new Map<string, number>();
    let currentPlace = 0;
    let lastScore: number | null = null;
    sorted.forEach((id, index) => {
      const score = scores.get(id) ?? 0;
      if (score !== lastScore) {
        currentPlace = index + 1;
        lastScore = score;
      }
      places.set(id, currentPlace);
    });
    return places;
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

    const scoreById = new Map<string, number>();
    for (const [id, { score }] of scoreMap) scoreById.set(id, score);
    const places = this.assignPlaces(
      scoreById,
      game.users.map((u) => u.id),
    );

    return [...scoreMap.values()]
      .map(({ user, score }) => ({
        user,
        score,
        place: places.get(user.id)!,
      }))
      .sort((a, b) => a.place - b.place || a.user.id.localeCompare(b.user.id));
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

  async getStandings(gameId: number, roundId: number) {
    const game = await this.prisma.client.game.findFirstOrThrow({
      where: { id: gameId },
      include: {
        users: true,
        rounds: {
          include: {
            picks: {
              include: { votes: true },
            },
          },
        },
      },
    });

    const rounds = [...game.rounds].sort((a, b) => a.id - b.id);
    const targetIndex = rounds.findIndex((r) => r.id === roundId);
    if (targetIndex === -1) {
      throw new NotFoundException('Round not found in this game');
    }

    const computeTotals = (subset: typeof rounds) => {
      const totals = new Map<string, number>();
      for (const user of game.users) totals.set(user.id, 0);
      for (const round of subset) {
        for (const pick of round.picks) {
          for (const vote of pick.votes) {
            if (vote.guessedUserId === pick.userId) {
              totals.set(
                vote.guessUserId,
                (totals.get(vote.guessUserId) ?? 0) + 1,
              );
            }
          }
        }
      }
      return totals;
    };

    const totalScores = computeTotals(rounds.slice(0, targetIndex + 1));
    const previousTotals =
      targetIndex > 0 ? computeTotals(rounds.slice(0, targetIndex)) : null;

    const roundScores = new Map<string, number>();
    for (const user of game.users) roundScores.set(user.id, 0);
    for (const pick of rounds[targetIndex].picks) {
      for (const vote of pick.votes) {
        if (vote.guessedUserId === pick.userId) {
          roundScores.set(
            vote.guessUserId,
            (roundScores.get(vote.guessUserId) ?? 0) + 1,
          );
        }
      }
    }

    const userIds = game.users.map((u) => u.id);
    const places = this.assignPlaces(totalScores, userIds);
    const previousPlaces = previousTotals
      ? this.assignPlaces(previousTotals, userIds)
      : null;

    const standings = game.users.map((user) => ({
      user,
      totalScore: totalScores.get(user.id) ?? 0,
      roundScore: roundScores.get(user.id) ?? 0,
      place: places.get(user.id)!,
      previousPlace: previousPlaces ? previousPlaces.get(user.id)! : null,
    }));

    standings.sort(
      (a, b) => a.place - b.place || a.user.id.localeCompare(b.user.id),
    );

    return standings;
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
          themeId: null,
          customTheme: null,
        },
      });

      // 2. Find non-completed active rounds (themed, not yet revealed)
      const activeRounds = await tx.round.findMany({
        where: {
          gameId,
          OR: [{ themeId: { not: null } }, { customTheme: { not: null } }],
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
