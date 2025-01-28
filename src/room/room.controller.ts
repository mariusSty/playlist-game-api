import { faker } from '@faker-js/faker';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomService } from './room.service';

@Controller('room')
export class RoomController {
  constructor(
    private readonly roomService: RoomService,
    private readonly userService: UserService,
  ) {}

  @Post()
  async create(@Body() createRoomDto: CreateRoomDto) {
    const { id, name } = createRoomDto;
    const user = await this.userService.upsertUser(
      id,
      name ? name : faker.animal.cat(),
    );
    return this.roomService.create(user.id);
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
    const user = await this.userService.upsertUser(
      id,
      name ? name : faker.animal.cat(),
    );
    return this.roomService.connect(pin, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roomService.remove(+id);
  }
}
