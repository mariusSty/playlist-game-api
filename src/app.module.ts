import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game/game.module';
import { RoomModule } from './room/room.module';
import { UserService } from './user/user.service';
import { RoundModule } from './round/round.module';
import { PickModule } from './pick/pick.module';

@Module({
  imports: [RoomModule, GameModule, RoundModule, PickModule],
  controllers: [AppController],
  providers: [AppService, PrismaService, UserService],
})
export class AppModule {}
