import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class RoundService {
  constructor(private prisma: PrismaService) {}

  get(id: number) {
    return this.prisma.client.round.findUnique({
      where: {
        id,
      },
      include: {
        themeMaster: true,
        theme: true,
        game: {
          include: {
            room: {
              include: {
                users: true,
              },
            },
          },
        },
        picks: {
          include: {
            votes: {
              include: {
                guessUser: true,
                guessedUser: true,
              },
            },
            track: true,
            user: true,
          },
        },
        readies: {
          select: { userId: true },
        },
      },
    });
  }

  async update(
    id: number,
    data: { themeId?: number | null; customTheme?: string | null },
  ) {
    return this.prisma.client.round.update({
      where: {
        id,
      },
      data: {
        themeId: data.themeId ?? null,
        customTheme: data.customTheme ?? null,
      },
    });
  }

  async markReady(roundId: number, userId: string) {
    const round = await this.prisma.client.round.findUnique({
      where: { id: roundId },
      include: {
        game: { include: { users: { select: { id: true } } } },
        readies: { select: { userId: true } },
      },
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }

    const totalCount = round.game.users.length;
    const isPlayer = round.game.users.some((u) => u.id === userId);
    if (!isPlayer) {
      throw new NotFoundException('User is not part of this game');
    }

    await this.prisma.client.roundReady.upsert({
      where: { roundId_userId: { roundId, userId } },
      create: { roundId, userId },
      update: {},
    });

    const readyCount = await this.prisma.client.roundReady.count({
      where: { roundId },
    });

    let completed = round.revealCompleted;
    if (!completed && readyCount >= totalCount) {
      await this.prisma.client.round.update({
        where: { id: roundId },
        data: { revealCompleted: true },
      });
      completed = true;
    }

    return { readyCount, totalCount, completed };
  }
}
