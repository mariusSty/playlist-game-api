import { Module } from '@nestjs/common';
import { RoundController } from './round.controller';
import { RoundGateway } from './round.gateway';
import { RoundService } from './round.service';

@Module({
  controllers: [RoundController],
  providers: [RoundService, RoundGateway],
  exports: [RoundService],
})
export class RoundModule {}
