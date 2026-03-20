import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MusicApiService } from 'src/pick/musicapi.service';
import { RoomModule } from 'src/room/room.module';
import { PickController } from './pick.controller';
import { PickService } from './pick.service';
import { VoteController } from './vote/vote.controller';
import { VoteService } from './vote/vote.service';

@Module({
  imports: [ConfigModule.forRoot(), RoomModule],
  controllers: [PickController, VoteController],
  providers: [PickService, VoteService, MusicApiService],
  exports: [PickService, VoteService],
})
export class PickModule {}
