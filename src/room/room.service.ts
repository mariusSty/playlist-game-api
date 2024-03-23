import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  create(createRoomDto: Prisma.RoomCreateInput) {
    return this.prisma.room.create({
      data: createRoomDto,
    });
  }

  findOne(id: number) {
    return this.prisma.room.findUnique({
      where: {
        id,
      },
    });
  }

  update(id: number, updateRoomDto: Prisma.RoomUpdateInput) {
    return this.prisma.room.update({
      where: {
        id,
      },
      data: updateRoomDto,
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
