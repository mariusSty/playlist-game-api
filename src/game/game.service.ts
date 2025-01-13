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
      },
      include: {
        rounds: true,
      },
    });
  }

  findOne(pin: string) {
    return this.prisma.game.findFirstOrThrow({
      where: {
        room: {
          pin,
        },
      },
      include: {
        rounds: {
          include: {
            themeMaster: true,
          },
        },
      },
    });
  }
}
