import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { GameService } from './game.service';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get(':pin')
  async findOne(@Param('pin') pin: string) {
    return this.gameService.findOne(pin);
  }

  @Get(':pin/votes')
  async findVote(@Param('pin') pin: string) {
    return this.gameService.getPickWithoutVotes(pin);
  }

  @Get('pick/:pickId')
  async findPick(@Param('pickId', ParseIntPipe) pickId: number) {
    return this.gameService.getPickById(pickId);
  }

  @Get('round/:roundId')
  async findRound(@Param('roundId', ParseIntPipe) roundId: number) {
    return this.gameService.getRound(roundId);
  }
}
