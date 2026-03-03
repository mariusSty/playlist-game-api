import {
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from 'src/game/game.service';
import { AssignSongDto } from 'src/pick/dto/assign-song.dto';
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

  @SubscribeMessage('validSong')
  async handleValidSong(
    @MessageBody()
    data: AssignSongDto & { pin: string },
  ) {
    await this.pickService.assignTrack(data);
    const [picks, room] = await Promise.all([
      this.pickService.getByRoundId(data.roundId),
      this.roomService.findOne(data.pin),
    ]);
    if (!room) return;
    const allValidated = room.users.length === picks.length;
    if (allValidated) {
      const pick = await this.pickService.getFirstWithoutVotes(data.pin);
      this.server.to(data.pin).emit('allSongsValidated', {
        pickId: pick.id,
        pin: data.pin,
      });
    } else {
      this.server.to(data.pin).emit('songValidated', {
        pin: data.pin,
        users: picks.map((pick) => pick.user.id),
      });
    }
  }

  @SubscribeMessage('cancelSong')
  async handleCancelSong(
    @MessageBody() data: { roundId: string; userId: string; pin: string },
  ) {
    await this.pickService.remove(Number(data.roundId), data.userId);
    const picks = await this.pickService.getByRoundId(Number(data.roundId));
    this.server.to(data.pin).emit('songCanceled', {
      pin: data.pin,
      users: picks.map((pick) => pick.user.id),
    });
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
