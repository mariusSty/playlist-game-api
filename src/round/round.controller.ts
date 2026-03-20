import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SessionGateway } from 'src/session/session.gateway';
import { PickThemeDto } from './dto/pick-theme.dto';
import { RoundService } from './round.service';

@Controller('round')
export class RoundController {
  constructor(
    private readonly roundService: RoundService,
    private readonly sessionGateway: SessionGateway,
  ) {}

  @Get(':roundId')
  async findRound(@Param('roundId', ParseIntPipe) roundId: number) {
    const round = await this.roundService.get(roundId);
    if (!round) {
      throw new NotFoundException('Round not found');
    }
    return round;
  }

  @Patch(':roundId')
  async pickTheme(
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() pickThemeDto: PickThemeDto,
  ) {
    const round = await this.roundService.get(roundId);
    if (!round) {
      throw new NotFoundException('Round not found');
    }

    if (round.themeMasterId !== pickThemeDto.userId) {
      throw new ForbiddenException('Only the theme master can pick the theme');
    }

    const updated = await this.roundService.update(roundId, pickThemeDto.theme);

    this.sessionGateway.emitSessionUpdated(pickThemeDto.pin);

    return updated;
  }

  @Post('next')
  async nextRound(@Query('pin') pin: string) {
    await this.roundService.markRevealCompleted(pin);
    this.sessionGateway.emitSessionUpdated(pin);
    return;
  }
}
