import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { RoundService } from './round.service';

@Controller('round')
export class RoundController {
  constructor(private readonly roundService: RoundService) {}

  @Get(':roundId')
  async findRound(@Param('roundId', ParseIntPipe) roundId: number) {
    return this.roundService.get(roundId);
  }
}
