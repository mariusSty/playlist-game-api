import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PickController } from './pick.controller';
import { PickService } from './pick.service';
import { VoteService } from './vote/vote.service';

@Module({
  controllers: [PickController],
  providers: [PickService, PrismaService, VoteService],
})
export class PickModule {}
