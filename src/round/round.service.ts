import { Injectable } from '@nestjs/common';
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

  async markRevealCompleted(pin: string) {
    // Find the current round (themed, not yet reveal-completed)
    const round = await this.prisma.client.round.findFirst({
      where: {
        game: { room: { pin } },
        OR: [{ themeId: { not: null } }, { customTheme: { not: null } }],
        revealCompleted: false,
      },
      orderBy: { id: 'asc' },
    });

    if (!round) return null;

    return this.prisma.client.round.update({
      where: { id: round.id },
      data: { revealCompleted: true },
    });
  }
}
