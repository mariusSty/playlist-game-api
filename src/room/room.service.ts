import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from 'src/prisma.service';
import { RoomPhase } from './types/room-phase.type';

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  async getPhase(pin: string): Promise<RoomPhase> {
    const room = await this.prisma.client.room.findUnique({
      where: { pin },
      include: {
        games: {
          orderBy: { id: 'desc' as const },
          take: 1,
        },
      },
    });

    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }

    const activeGame = room.games[0];
    if (!activeGame) {
      return { phase: 'lobby' };
    }

    return { phase: 'playing', gameId: activeGame.id };
  }

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

  async create(userId: string, pin: string) {
    Sentry.logger.info('Room created', { pin, hostId: userId });
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
    });
  }

  findOne(pin: string) {
    return this.prisma.client.room.findUnique({
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
    Sentry.logger.info('Player connecting to room', { pin, userId: id });
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
        include: {
          users: true,
          host: true,
        },
      });
    } catch (error) {
      Sentry.logger.warn('Room not found', { pin });
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }
  }

  disconnect(pin: string, id: string) {
    Sentry.logger.info('Player disconnected from room', { pin, userId: id });
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
    Sentry.logger.info('Room host transferred', { pin, newHostId: hostId });
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
    Sentry.logger.info('Room deleted', { roomId: id });
    return this.prisma.client.room.delete({
      where: {
        id,
      },
    });
  }
}
