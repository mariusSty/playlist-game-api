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

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.gameService.findOne(+id);
  }
}
