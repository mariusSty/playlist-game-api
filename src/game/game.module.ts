import { Module } from '@nestjs/common';
import { RoomModule } from 'src/room/room.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';

@Module({
  imports: [RoomModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
