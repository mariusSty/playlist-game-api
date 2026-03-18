import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CreateVoteDto } from 'src/pick/dto/create-vote.dto';
import { VoteGateway } from './vote.gateway';
import { VoteService } from './vote.service';

@Controller('vote')
export class VoteController {
  constructor(
    private readonly voteService: VoteService,
    private readonly voteGateway: VoteGateway,
  ) {}

  @Post()
  async create(
    @Body() createVoteDto: CreateVoteDto,
    @Query('pin') pin: string,
  ) {
    await this.voteService.create(createVoteDto);
    this.voteGateway.emitGameStateChanged(pin);
    return { success: true };
  }

  @Delete(':pickId/:userId')
  async cancel(
    @Param('pickId', ParseIntPipe) pickId: number,
    @Param('userId') userId: string,
    @Query('pin') pin: string,
  ) {
    await this.voteService.remove(pickId, userId);
    this.voteGateway.emitGameStateChanged(pin);
    return { success: true };
  }
}
