import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { GameService } from './game.service';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.gameService.findOne(id);
  }

  @Get(':id/result')
  async findResult(@Param('id', ParseIntPipe) id: number) {
    const game = await this.gameService.findOne(id);
    const result = game.users.map((user) => {
      return {
        user,
        score: 0,
      };
    });

    for (const round of game.rounds) {
      for (const pick of round.picks) {
        for (const vote of pick.votes) {
          if (vote.guessedUserId === pick.userId) {
            result.find((user) => user.user.id === vote.guessUserId).score++;
          }
        }
      }
    }

    return result;
  }
}
