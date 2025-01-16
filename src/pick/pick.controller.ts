import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { SpotifyService } from 'src/pick/spotify.service';
import { PickService } from './pick.service';

@Controller('pick')
export class PickController {
  constructor(
    private readonly pickService: PickService,
    private readonly spotifyService: SpotifyService,
  ) {}

  @Get(':pickId')
  async findPick(@Param('pickId', ParseIntPipe) pickId: number) {
    return this.pickService.getById(pickId);
  }

  @Get('search/:text')
  search(@Param('text') text: string) {
    return this.spotifyService.search(text);
  }
}
