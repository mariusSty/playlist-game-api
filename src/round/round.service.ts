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
      cacheStrategy: { swr: 15, ttl: 15 },
    });
  }

  getNext(pin: string) {
    return this.prisma.client.round.findFirst({
      where: {
        game: {
          room: {
            pin,
          },
        },
        theme: {
          equals: '',
        },
      },
    });
  }

  update(id: number, theme: string) {
    return this.prisma.client.round.update({
      where: {
        id,
      },
      data: {
        theme,
      },
    });
  }
}
