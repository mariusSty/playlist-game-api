import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { PickService } from './pick.service';

@Controller('pick')
export class PickController {
  constructor(private readonly pickService: PickService) {}

  @Get(':pickId')
  async findPick(@Param('pickId', ParseIntPipe) pickId: number) {
    return this.pickService.getPickById(pickId);
  }
}
