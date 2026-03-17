import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
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

    Sentry.logger.info('Game started', {
      pin: createGameDto.pin,
      gameId: game.id,
      playerCount: room.users.length,
      roundCount: game.rounds.length,
      firstRoundId: firstRound.id,
    });

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
    const results = this.gameService.calculateResults(game);
    const winner = results.reduce((a, b) => (a.score > b.score ? a : b));
    Sentry.logger.info('Game results computed', {
      gameId: id,
      winnerName: winner.user.name,
      topScore: winner.score,
    });
    return results;
  }

  @Patch(':id/finish')
  async finish(@Param('id', ParseIntPipe) id: number) {
    Sentry.logger.info('Game finished', { gameId: id });
    await this.gameService.detachRoom(id);
    return { finished: true };
  }
}
