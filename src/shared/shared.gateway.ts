import {
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from 'src/game/game.service';
import { PickService } from 'src/pick/pick.service';
import { VoteService } from 'src/pick/vote/vote.service';
import { RoomService } from 'src/room/room.service';
import { RoundService } from 'src/round/round.service';

@WebSocketGateway()
export class SharedGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
    private readonly roundService: RoundService,
    private readonly pickService: PickService,
    private readonly voteService: VoteService,
  ) {}

  async handleDisconnect(client: Socket) {
    // Socket.IO rooms are cleaned up automatically on disconnect
  }

  @SubscribeMessage('vote')
  async handleVote(
    @MessageBody()
    data: {
      pickId: string;
      guessId: string;
      userId: string;
      pin: string;
    },
  ) {
    await this.voteService.create(data);
    const [votes, room] = await Promise.all([
      this.voteService.getByPickId(Number(data.pickId)),
      this.roomService.findOne(data.pin),
    ]);
    if (!room) return;
    const allVoted = room.users.length === votes.length;
    if (allVoted) {
      const pick = await this.pickService.getFirstWithoutVotes(data.pin);
      this.server.to(data.pin).emit('allVotesValidated', {
        pickId: pick ? pick.id : null,
        pin: data.pin,
      });
    } else {
      this.server.to(data.pin).emit('voteValidated', {
        pin: data.pin,
        users: votes.map((vote) => vote.guessUserId),
      });
    }
  }

  @SubscribeMessage('cancelVote')
  async handleCancelVote(
    @MessageBody() data: { pickId: string; userId: string; pin: string },
  ) {
    await this.voteService.remove(Number(data.pickId), data.userId);
    const votes = await this.voteService.getByPickId(Number(data.pickId));
    this.server.to(data.pin).emit('voteCanceled', {
      pin: data.pin,
      users: votes.map((vote) => vote.guessUserId),
    });
  }

  @SubscribeMessage('nextRound')
  async handleNextRound(@MessageBody() data: { pin: string; gameId: string }) {
    const round = await this.roundService.getNext(data.pin);
    if (round) {
      this.server
        .to(data.pin)
        .emit('newRound', { roundId: round.id, pin: data.pin });
    } else {
      await this.gameService.detachRoom(+data.gameId);
      this.server.to(data.pin).emit('goToResult', { pin: data.pin });
    }
  }
}
