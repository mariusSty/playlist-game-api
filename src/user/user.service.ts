import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { UserSession } from './types/user-session.type';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async upsertUser(id: string, name: string) {
    return this.prisma.client.user.upsert({
      where: {
        id,
      },
      update: {
        name,
      },
      create: {
        id,
        name,
      },
    });
  }

  async getSession(userId: string): Promise<UserSession> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: {
        room: {
          include: {
            games: {
              where: { roomId: { not: null } },
              orderBy: { id: 'desc' as const },
              take: 1,
              include: {
                users: true,
                rounds: {
                  orderBy: { id: 'asc' as const },
                  include: {
                    picks: {
                      orderBy: [
                        { position: 'asc' as const },
                        { id: 'asc' as const },
                      ],
                      include: { votes: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user?.room) {
      return { phase: 'home' };
    }

    const pin = user.room.pin;
    const activeGame = user.room.games[0];

    if (!activeGame) {
      return { phase: 'lobby', pin };
    }

    const gameId = activeGame.id;
    const playerCount = activeGame.users.length;

    const isThemePicked = (r: { themeId: number | null; customTheme: string | null }) =>
      r.themeId !== null || r.customTheme !== null;

    const activeRounds = activeGame.rounds.filter(
      (r) => isThemePicked(r) && !r.revealCompleted,
    );
    const currentRound = activeRounds[0];

    if (!currentRound) {
      const nextUnthemed = activeGame.rounds.find(
        (r) => !isThemePicked(r) && !r.revealCompleted,
      );
      if (!nextUnthemed) {
        return { phase: 'result', pin, gameId };
      }
      return { phase: 'theme', pin, gameId, roundId: nextUnthemed.id };
    }

    const pickCount = currentRound.picks.length;

    if (pickCount < playerCount) {
      return { phase: 'song', pin, gameId, roundId: currentRound.id };
    }

    const firstUnvotedPick = currentRound.picks.find(
      (pick) => pick.votes.length < playerCount,
    );

    if (firstUnvotedPick) {
      return {
        phase: 'vote',
        pin,
        gameId,
        roundId: currentRound.id,
        pickId: firstUnvotedPick.id,
      };
    }

    return { phase: 'reveal', pin, gameId, roundId: currentRound.id };
  }
}
