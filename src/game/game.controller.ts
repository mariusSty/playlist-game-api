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
import { RoomService } from 'src/room/room.service';
import { SessionGateway } from 'src/session/session.gateway';
import { CreateGameDto } from './dto/create-game.dto';
import { GameService } from './game.service';

@Controller('game')
export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly roomService: RoomService,
    private readonly sessionGateway: SessionGateway,
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

    this.sessionGateway.emitSessionUpdated(createGameDto.pin);

    return { roundId: firstRound.id, gameId: game.id };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.gameService.findOne(id);
  }

  @Get(':id/result')
  async findResult(@Param('id', ParseIntPipe) id: number) {
    const game = await this.gameService.findOne(id);
    return this.gameService.calculateResults(game);
  }

  @Get(':gameId/standings/:roundId')
  async findStandings(
    @Param('gameId', ParseIntPipe) gameId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
  ) {
    return this.gameService.getStandings(gameId, roundId);
  }

  @Patch(':id/finish')
  async finish(@Param('id', ParseIntPipe) id: number) {
    const game = await this.gameService.findWithRoom(id);
    const pin = game.room?.pin;

    await this.gameService.detachRoom(id);

    if (pin) {
      this.sessionGateway.emitSessionUpdated(pin);
    }

    return { finished: true };
  }
}
