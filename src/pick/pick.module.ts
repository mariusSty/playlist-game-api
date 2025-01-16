import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpotifyService } from 'src/pick/spotify.service';
import { PrismaService } from 'src/prisma.service';
import { PickController } from './pick.controller';
import { PickService } from './pick.service';
import { VoteService } from './vote/vote.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [PickController],
  providers: [PickService, PrismaService, VoteService, SpotifyService],
})
export class PickModule {}
