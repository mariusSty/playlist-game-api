import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  findByHostId(hostId: string) {
    return this.prisma.client.room.findUnique({
      where: {
        hostId,
      },
      include: {
        users: true,
        host: true,
      },
    });
  }

  create(userId: string, pin: string) {
    return this.prisma.client.room.create({
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
    return this.prisma.client.room.findUnique({
      where: {
        pin,
      },
      cacheStrategy: { swr: 10, ttl: 10 },
    });
  }

  findOne(pin: string) {
    return this.prisma.client.room.findUniqueOrThrow({
      where: {
        pin,
      },
      include: {
        users: true,
        host: true,
      },
      cacheStrategy: { swr: 15, ttl: 15 },
    });
  }

  async connect(pin: string, id: string) {
    try {
      return await this.prisma.client.room.update({
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
    return this.prisma.client.room.update({
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
    return this.prisma.client.room.update({
      where: {
        pin,
      },
      data: {
        hostId,
      },
    });
  }

  remove(id: number) {
    return this.prisma.client.room.delete({
      where: {
        id,
      },
    });
  }
}
