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
import { SessionGateway } from 'src/session/session.gateway';
import { UserService } from 'src/user/user.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomService } from './room.service';

@Controller('room')
export class RoomController {
  constructor(
    private readonly roomService: RoomService,
    private readonly userService: UserService,
    private readonly sessionGateway: SessionGateway,
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
    this.sessionGateway.emitSessionUpdated(pin);
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
    this.sessionGateway.emitSessionUpdated(pin);

    return { users: remainingUsers, hostId };
  }
}
