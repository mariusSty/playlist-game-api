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
import { RoomService } from 'src/room/room.service';
import { AssignSongDto } from './dto/assign-song.dto';
import { PickGateway } from './pick.gateway';
import { PickService } from './pick.service';

@Controller('pick')
export class PickController {
  constructor(
    private readonly pickService: PickService,
    private readonly musicApiService: MusicApiService,
    private readonly roomService: RoomService,
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
    const [picks, room] = await Promise.all([
      this.pickService.getByRoundId(assignSongDto.roundId),
      this.roomService.findOne(pin),
    ]);
    const users = picks.map((pick) => pick.user.id);
    const allPicked = room && room.users.length === picks.length;
    let firstPickId: number | undefined;
    if (allPicked) {
      const firstPick = await this.pickService.getFirstWithoutVotes(pin);
      firstPickId = firstPick?.id;
    }
    this.pickGateway.emitPickUpdated(pin, users, firstPickId);
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
