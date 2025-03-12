import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  create(pin: string, userIds: string[]) {
    return this.prisma.game.create({
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
    return this.prisma.game.findFirstOrThrow({
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

  detachRoom(id: number) {
    return this.prisma.game.update({
      data: {
        roomId: null,
      },
      where: {
        id,
      },
    });
  }
}
