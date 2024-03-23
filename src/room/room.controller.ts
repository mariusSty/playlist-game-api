import {
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { RoomService } from './room.service';

@Controller('room')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  async create() {
    return this.roomService.create();
  }

  @Get(':pin')
  findOne(@Param('pin') pin: string) {
    return this.roomService.findOne(pin);
  }

  @Patch(':pin')
  async update(@Param('pin') pin: string) {
    try {
      const roomUpdated = await this.roomService.update(pin);
      return roomUpdated;
    } catch (error) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roomService.remove(+id);
  }
}
