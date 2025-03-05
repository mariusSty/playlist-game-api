import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, pin: string) {
    return this.prisma.room.create({
      data: {
        pin,
        users: {
          connect: {
            id: userId,
          },
        },
        host: {
          connect: {
            id: userId,
          },
        },
      },
    });
  }

  findIfExists(pin: string) {
    return this.prisma.room.findUnique({
      where: {
        pin,
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
        host: true,
      },
    });
  }

  async connect(pin: string, id: string) {
    try {
      return await this.prisma.room.update({
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
    } catch (error) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }
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
