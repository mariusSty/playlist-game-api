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
import { CreateRoomDto } from '../dto/create-room.dto';
import { RoomService } from './room.service';

@Controller('room')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  async create(@Body() createRoomDto: CreateRoomDto) {
    const { id, name } = createRoomDto;
    return this.roomService.create(id, name);
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
    try {
      const { id, name } = updateRoomDto;
      return await this.roomService.update(pin, id, name);
    } catch (error) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roomService.remove(+id);
  }
}
