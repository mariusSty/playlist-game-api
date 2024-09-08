import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  create(id: string) {
    return this.prisma.room.create({
      data: {
        pin: faker.number
          .int({ min: 0, max: 9999 })
          .toString()
          .padStart(4, '0'),
        users: {
          connect: {
            id,
          },
        },
        host: {
          connect: {
            id,
          },
        },
      },
    });
  }

  findOne(pin: string) {
    return this.prisma.room.findUniqueOrThrow({
      where: {
        pin,
      },
      include: {
        users: true,
      },
    });
  }

  connect(pin: string, id: string) {
    return this.prisma.room.update({
      where: {
        pin,
      },
      data: {
        users: {
          connect: {
            id,
          },
        },
      },
    });
  }

  disconnect(pin: string, id: string) {
    return this.prisma.room.update({
      where: {
        pin,
      },
      data: {
        users: {
          disconnect: {
            id,
          },
        },
      },
    });
  }

  updateHost(pin: string, hostId: string) {
    return this.prisma.room.update({
      where: {
        pin,
      },
      data: {
        hostId,
      },
    });
  }
  remove(id: number) {
    return this.prisma.room.delete({
      where: {
        id,
      },
    });
  }
}
