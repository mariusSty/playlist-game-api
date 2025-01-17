import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { MusicApiService } from 'src/pick/musicapi.service';
import { PickService } from './pick.service';

@Controller('pick')
export class PickController {
  constructor(
    private readonly pickService: PickService,
    private readonly musicApiService: MusicApiService,
  ) {}

  @Get(':pickId')
  async findPick(@Param('pickId', ParseIntPipe) pickId: number) {
    return this.pickService.getById(pickId);
  }

  @Get('search/:text')
  search(@Param('text') text: string) {
    return this.musicApiService.search(text);
  }
}
