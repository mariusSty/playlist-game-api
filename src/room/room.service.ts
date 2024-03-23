import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  create() {
    return this.prisma.room.create({
      data: {
        pin: faker.number
          .int({ min: 0, max: 9999 })
          .toString()
          .padStart(4, '0'),
        users: {
          create: {
            name: faker.animal.cat(),
            isHost: true,
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

  update(pin: string) {
    return this.prisma.room.update({
      where: {
        pin,
      },
      data: {
        users: {
          create: {
            name: faker.animal.cat(),
          },
        },
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
