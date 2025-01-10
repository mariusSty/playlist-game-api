import { Controller, Get, Param } from '@nestjs/common';
import { GameService } from './game.service';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get(':pin')
  async findOne(@Param('pin') pin: string) {
    return this.gameService.findOne(pin);
  }
}
