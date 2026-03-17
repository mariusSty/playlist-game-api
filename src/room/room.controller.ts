import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { UserService } from 'src/user/user.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomGateway } from './room.gateway';
import { RoomService } from './room.service';

@Controller('room')
export class RoomController {
  constructor(
    private readonly roomService: RoomService,
    private readonly userService: UserService,
    private readonly roomGateway: RoomGateway,
  ) {}

  @Post()
  async create(@Body() createRoomDto: CreateRoomDto) {
    const { id, name } = createRoomDto;
    const user = await this.userService.upsertUser(id, name);

    const existingRoom = await this.roomService.findByHostId(user.id);
    if (existingRoom) {
      return existingRoom;
    }

    let exists = true;
    let pin: string;
    while (exists) {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      exists = !!(await this.roomService.findIfExists(pin));
    }
    const room = await this.roomService.create(user.id, pin);
    Sentry.logger.info('Room created', { pin, hostId: user.id, hostName: name });
    return room;
  }

  @Get(':pin')
  findOne(@Param('pin') pin: string) {
    return this.roomService.findOne(pin);
  }

  @Patch(':pin')
  async update(
    @Param('pin') pin: string,
    @Body() updateRoomDto: CreateRoomDto,
  ) {
    const { id, name } = updateRoomDto;
    const user = await this.userService.upsertUser(id, name);
    const room = await this.roomService.connect(pin, user.id);
    Sentry.logger.info('Player joined room', { pin, userId: user.id, name, totalPlayers: room.users.length });
    this.roomGateway.emitRoomUpdated(pin, room.users, room.hostId);
    return room;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roomService.remove(+id);
  }

  @Delete(':pin/users/:userId')
  async leave(@Param('pin') pin: string, @Param('userId') userId: string) {
    const room = await this.roomService.findOne(pin);
    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }

    // Last user → delete the room entirely
    if (room.users.length === 1) {
      Sentry.logger.info('Room deleted (last player left)', { pin, lastUserId: userId });
      await this.roomService.remove(room.id);
      return { deleted: true };
    }

    // If the leaving user is the host, transfer host to another user
    let hostId = room.hostId;
    if (room.hostId === userId) {
      const newHostId = room.users.find((u) => u.id !== userId)?.id;
      await this.roomService.updateHost(pin, newHostId);
      hostId = newHostId;
    }

    await this.roomService.disconnect(pin, userId);

    const remainingUsers = room.users.filter((u) => u.id !== userId);
    Sentry.logger.info('Player left room', { pin, userId, remainingPlayers: remainingUsers.length, hostId });
    this.roomGateway.emitRoomUpdated(pin, remainingUsers, hostId);

    return { users: remainingUsers, hostId };
  }
}
