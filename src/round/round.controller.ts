import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { SessionGateway } from 'src/session/session.gateway';
import { MarkReadyDto } from './dto/mark-ready.dto';
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

    const hasThemeId =
      pickThemeDto.themeId !== undefined && pickThemeDto.themeId !== null;
    const hasCustom =
      typeof pickThemeDto.customTheme === 'string' &&
      pickThemeDto.customTheme.trim().length > 0;

    if (hasThemeId === hasCustom) {
      throw new BadRequestException(
        'Provide exactly one of themeId or customTheme',
      );
    }

    if (hasCustom && pickThemeDto.customTheme.trim().length > 300) {
      throw new BadRequestException(
        'customTheme must be at most 300 characters',
      );
    }

    const updated = await this.roundService.update(roundId, {
      themeId: hasThemeId ? pickThemeDto.themeId : null,
      customTheme: hasCustom ? pickThemeDto.customTheme!.trim() : null,
    });

    this.sessionGateway.emitSessionUpdated(pickThemeDto.pin);

    return updated;
  }

  @Post(':roundId/ready')
  async markReady(
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() markReadyDto: MarkReadyDto,
  ) {
    const result = await this.roundService.markReady(
      roundId,
      markReadyDto.userId,
    );
    this.sessionGateway.emitSessionUpdated(markReadyDto.pin);
    return result;
  }
}
