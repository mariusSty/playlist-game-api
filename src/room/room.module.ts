import { Module } from '@nestjs/common';
import { GameService } from 'src/game/game.service';
import { PickService } from 'src/pick/pick.service';
import { VoteService } from 'src/pick/vote/vote.service';
import { PrismaService } from 'src/prisma.service';
import { RoundService } from 'src/round/round.service';
import { UserService } from 'src/user/user.service';
import { RoomController } from './room.controller';
import { RoomGateway } from './room.gateway';
import { RoomService } from './room.service';

@Module({
  controllers: [RoomController],
  providers: [
    RoomService,
    PrismaService,
    UserService,
    RoomGateway,
    GameService,
    RoundService,
    PickService,
    VoteService,
  ],
})
export class RoomModule {}
