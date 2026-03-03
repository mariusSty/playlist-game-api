import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game/game.module';
import { PickModule } from './pick/pick.module';
import { RoomModule } from './room/room.module';
import { RoundModule } from './round/round.module';
import { UserService } from './user/user.service';

@Module({
  imports: [PrismaModule, RoomModule, GameModule, RoundModule, PickModule],
  controllers: [AppController],
  providers: [AppService, UserService],
})
export class AppModule {}
