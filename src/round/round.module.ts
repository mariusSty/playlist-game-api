import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { RoundController } from './round.controller';
import { RoundService } from './round.service';

@Module({
  controllers: [RoundController],
  providers: [RoundService, PrismaService],
})
export class RoundModule {}
