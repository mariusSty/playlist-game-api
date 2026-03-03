import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { RoomService } from 'src/room/room.service';
import { CreateGameDto } from './dto/create-game.dto';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Controller('game')
export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly roomService: RoomService,
    private readonly gameGateway: GameGateway,
  ) {}

  @Post()
  async create(@Body() createGameDto: CreateGameDto) {
    const room = await this.roomService.findOne(createGameDto.pin);
    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }

    const game = await this.gameService.create(
      createGameDto.pin,
      room.users.map((user) => user.id),
    );

    const firstRound = game.rounds[0];

    this.gameGateway.emitGameStarted(createGameDto.pin, {
      roundId: firstRound.id,
      gameId: game.id,
      pin: createGameDto.pin,
    });

    return { roundId: firstRound.id, gameId: game.id };
  }

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
