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
import { PickService } from 'src/pick/pick.service';
import { RoomService } from 'src/room/room.service';
import { VoteGateway } from './vote.gateway';
import { VoteService } from './vote.service';

@Controller('vote')
export class VoteController {
  constructor(
    private readonly voteService: VoteService,
    private readonly voteGateway: VoteGateway,
    private readonly pickService: PickService,
    private readonly roomService: RoomService,
  ) {}

  @Post()
  async create(
    @Body() createVoteDto: CreateVoteDto,
    @Query('pin') pin: string,
  ) {
    await this.voteService.create(createVoteDto);
    const [votes, room] = await Promise.all([
      this.voteService.getByPickId(Number(createVoteDto.pickId)),
      this.roomService.findOne(pin),
    ]);
    const users = votes.map((vote) => vote.guessUserId);
    const allVoted = room && room.users.length === votes.length;
    let nextPickId: number | null = undefined;
    if (allVoted) {
      const nextPick = await this.pickService.getFirstWithoutVotes(pin);
      nextPickId = nextPick ? nextPick.id : null;
    }
    this.voteGateway.emitVoteUpdated(pin, users, nextPickId);
    return { success: true };
  }

  @Delete(':pickId/:userId')
  async cancel(
    @Param('pickId', ParseIntPipe) pickId: number,
    @Param('userId') userId: string,
    @Query('pin') pin: string,
  ) {
    await this.voteService.remove(pickId, userId);
    const votes = await this.voteService.getByPickId(pickId);
    this.voteGateway.emitVoteUpdated(
      pin,
      votes.map((vote) => vote.guessUserId),
    );
    return { success: true };
  }
}
