import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { GameService } from './game.service';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post()
  create(@Body() createGameDto: CreateGameDto) {
    return this.gameService.create(createGameDto);
  }

  @Get(':pin')
  async findOne(@Param('pin') pin: string) {
    return this.gameService.findOne(pin);
  }

  @Get(':pin/pick')
  async pick(@Param('pin') pin: string) {
    const picks = await this.gameService.getPicks(pin);
    return picks[Math.floor(Math.random() * picks.length)];
  }
}
