import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MusicApiService } from 'src/pick/musicapi.service';
import { PickController } from './pick.controller';
import { PickService } from './pick.service';
import { VoteService } from './vote/vote.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [PickController],
  providers: [PickService, VoteService, MusicApiService],
  exports: [PickService, VoteService],
})
export class PickModule {}
