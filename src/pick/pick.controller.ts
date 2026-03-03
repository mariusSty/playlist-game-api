import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { MusicApiService } from 'src/pick/musicapi.service';
import { AssignSongDto } from './dto/assign-song.dto';
import { PickGateway } from './pick.gateway';
import { PickService } from './pick.service';

@Controller('pick')
export class PickController {
  constructor(
    private readonly pickService: PickService,
    private readonly musicApiService: MusicApiService,
    private readonly pickGateway: PickGateway,
  ) {}

  @Get(':pickId')
  async findPick(@Param('pickId', ParseIntPipe) pickId: number) {
    return this.pickService.getById(pickId);
  }

  @Get('search/:text')
  search(@Param('text') text: string) {
    return this.musicApiService.search(text);
  }

  @Post()
  async assignSong(
    @Body() assignSongDto: AssignSongDto,
    @Query('pin') pin: string,
  ) {
    await this.pickService.assignTrack(assignSongDto);
    const picks = await this.pickService.getByRoundId(assignSongDto.roundId);
    this.pickGateway.emitPickUpdated(
      pin,
      picks.map((pick) => pick.user.id),
    );
    return { success: true };
  }

  @Delete(':roundId/:userId')
  async cancelSong(
    @Param('roundId', ParseIntPipe) roundId: number,
    @Param('userId') userId: string,
    @Query('pin') pin: string,
  ) {
    await this.pickService.remove(roundId, userId);
    const picks = await this.pickService.getByRoundId(roundId);
    this.pickGateway.emitPickUpdated(
      pin,
      picks.map((pick) => pick.user.id),
    );
    return { success: true };
  }
}
