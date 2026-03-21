import { forwardRef, Module } from '@nestjs/common';
import { GameModule } from 'src/game/game.module';
import { UserModule } from 'src/user/user.module';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';

@Module({
  imports: [UserModule, forwardRef(() => GameModule)],
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
