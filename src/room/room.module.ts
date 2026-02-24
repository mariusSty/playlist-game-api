import { Module } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';

@Module({
  controllers: [RoomController],
  providers: [RoomService, UserService],
  exports: [RoomService],
})
export class RoomModule {}
