import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from 'src/prisma.service';
import { GamePhase } from './types/game-phase.type';

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  async getPhase(gameId: number): Promise<GamePhase> {
    const game = await this.prisma.client.game.findFirstOrThrow({
      where: { id: gameId },
      include: {
        users: true,
        rounds: {
          orderBy: { id: 'asc' as const },
          include: {
            picks: {
              orderBy: { id: 'asc' as const },
              include: {
                votes: true,
              },
            },
          },
        },
      },
    });

    // Game finished (detached from room)
    if (game.roomId === null) {
      return { phase: 'result' };
    }

    const playerCount = game.users.length;

    // Find the current round: last themed round whose reveal is not yet completed
    const activeRounds = game.rounds.filter(
      (r) => r.theme !== '' && !r.revealCompleted,
    );
    const currentRound = activeRounds[0];

    // No active round → find next unthemed round, or result
    if (!currentRound) {
      const nextUnthemed = game.rounds.find(
        (r) => r.theme === '' && !r.revealCompleted,
      );
      if (!nextUnthemed) {
        return { phase: 'result' };
      }
      return { phase: 'theme', roundId: nextUnthemed.id };
    }

    const pickCount = currentRound.picks.length;

    // Not all picks → song phase
    if (pickCount < playerCount) {
      return { phase: 'song', roundId: currentRound.id };
    }

    // All picks done — find first pick not fully voted
    const firstUnvotedPick = currentRound.picks.find(
      (pick) => pick.votes.length < playerCount,
    );

    if (firstUnvotedPick) {
      return {
        phase: 'vote',
        roundId: currentRound.id,
        pickId: firstUnvotedPick.id,
      };
    }

    // All votes done → reveal
    return { phase: 'reveal', roundId: currentRound.id };
  }

  findWithRoom(id: number) {
    return this.prisma.client.game.findFirstOrThrow({
      where: { id },
      include: { room: true },
    });
  }

  async create(pin: string, userIds: string[]) {
    Sentry.logger.info('Game created', {
      pin,
      playerCount: userIds.length,
      roundCount: userIds.length,
    });
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
    Sentry.logger.info('Results calculated', {
      gameId: game.id,
      roundCount: game.rounds.length,
    });
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
    Sentry.logger.info('Game finished', { gameId: id });
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
