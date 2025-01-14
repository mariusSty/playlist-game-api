import { Module } from '@nestjs/common';
import { GameService } from 'src/game/game.service';
import { PickService } from 'src/pick/pick.service';
import { VoteService } from 'src/pick/vote/vote.service';
import { PrismaService } from 'src/prisma.service';
import { RoomService } from 'src/room/room.service';
import { RoundService } from 'src/round/round.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game/game.module';
import { PickModule } from './pick/pick.module';
import { RoomModule } from './room/room.module';
import { RoundModule } from './round/round.module';
import { SharedGateway } from './shared/shared.gateway';
import { UserService } from './user/user.service';

@Module({
  imports: [RoomModule, GameModule, RoundModule, PickModule],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    UserService,
    SharedGateway,
    RoomService,
    GameService,
    RoundService,
    PickService,
    VoteService,
  ],
})
export class AppModule {}
