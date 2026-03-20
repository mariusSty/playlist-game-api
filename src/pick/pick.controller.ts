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
import { SessionGateway } from 'src/session/session.gateway';
import { AssignSongDto } from './dto/assign-song.dto';
import { PickService } from './pick.service';

@Controller('pick')
export class PickController {
  constructor(
    private readonly pickService: PickService,
    private readonly musicApiService: MusicApiService,
    private readonly sessionGateway: SessionGateway,
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
    this.sessionGateway.emitSessionUpdated(pin);
    return { success: true };
  }

  @Delete(':roundId/:userId')
  async cancelSong(
    @Param('roundId', ParseIntPipe) roundId: number,
    @Param('userId') userId: string,
    @Query('pin') pin: string,
  ) {
    await this.pickService.remove(roundId, userId);
    this.sessionGateway.emitSessionUpdated(pin);
    return { success: true };
  }
}
