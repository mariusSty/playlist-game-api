import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PickController } from './pick.controller';
import { PickService } from './pick.service';

@Module({
  controllers: [PickController],
  providers: [PickService, PrismaService],
})
export class PickModule {}
