import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MusicApiService } from 'src/pick/musicapi.service';
import { PrismaService } from 'src/prisma.service';
import { PickController } from './pick.controller';
import { PickService } from './pick.service';
import { VoteService } from './vote/vote.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [PickController],
  providers: [PickService, PrismaService, VoteService, MusicApiService],
})
export class PickModule {}
