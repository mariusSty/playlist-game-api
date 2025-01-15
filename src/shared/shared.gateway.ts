import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'http';
import { GameService } from 'src/game/game.service';
import { PickService } from 'src/pick/pick.service';
import { VoteService } from 'src/pick/vote/vote.service';
import { RoomService } from 'src/room/room.service';
import { RoundService } from 'src/round/round.service';

@WebSocketGateway()
export class SharedGateway {
  @WebSocketServer() server: Server;

  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
    private readonly roundService: RoundService,
    private readonly pickService: PickService,
    private readonly voteService: VoteService,
  ) {}

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(@MessageBody() data: { pin: string }) {
    const { pin } = data;
    const room = await this.roomService.findOne(pin);
    this.server.emit('userList', { users: room.users, hostId: room.hostId });
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(@MessageBody() data: { pin: string; userId: string }) {
    const { pin, userId } = data;
    const room = await this.roomService.findOne(pin);
    let hostId = room.hostId;
    if (room.users.length === 1) {
      return this.roomService.remove(room.id);
    }
    if (room.hostId === userId) {
      const newHostId = room.users.find((user) => user.id !== userId)?.id;
      await this.roomService.updateHost(pin, newHostId);
      hostId = newHostId;
    }
    await this.roomService.disconnect(pin, userId);
    this.server.emit('userList', {
      users: room.users.filter((user) => user.id !== userId),
      hostId,
    });
  }

  @SubscribeMessage('startGame')
  async handleStartGame(@MessageBody() data: { pin: string; userId: string }) {
    const room = await this.roomService.findOne(data.pin);
    await this.gameService.create(
      data.pin,
      room.users.map((user) => user.id),
    );
    const round = await this.roundService.getNext(data.pin);
    this.server.emit('gameStarted', {
      roundId: round.id,
      gameId: round.gameId,
    });
  }

  @SubscribeMessage('pickTheme')
  async handlePickTheme(
    @MessageBody() data: { roundId: number; theme: string },
  ) {
    await this.roundService.update(Number(data.roundId), data.theme);
    this.server.emit('themePicked', { roundId: data.roundId });
  }

  @SubscribeMessage('validSong')
  async handleValidSong(
    @MessageBody()
    data: {
      roundId: number;
      song: string;
      userId: string;
      pin: string;
    },
  ) {
    await this.pickService.assignSong(data);
    const picks = await this.pickService.countByRoundId(data.roundId);
    const room = await this.roomService.findOne(data.pin);
    const allValidated = room.users.length === picks;
    if (allValidated) {
      const pick = await this.pickService.getFirstWithoutVotes(data.pin);
      this.server.emit('songValidated', {
        pickId: pick.id,
      });
    }
  }

  @SubscribeMessage('cancelSong')
  async handleCancelSong(
    @MessageBody() data: { roundId: string; userId: string; pin: string },
  ) {
    await this.pickService.remove(Number(data.roundId), data.userId);
    this.server.emit('songCanceled');
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
    const votes = await this.voteService.countByPickId(Number(data.pickId));
    const room = await this.roomService.findOne(data.pin);
    const allVoted = room.users.length === votes;
    if (allVoted) {
      const pick = await this.pickService.getFirstWithoutVotes(data.pin);
      this.server.emit('voteValidated', {
        pickId: pick ? pick.id : null,
      });
    }
  }

  @SubscribeMessage('cancelVote')
  async handleCancelVote(
    @MessageBody() data: { pickId: string; userId: string },
  ) {
    await this.voteService.remove(Number(data.pickId), data.userId);
    this.server.emit('voteCanceled');
  }

  @SubscribeMessage('nextRound')
  async handleNextRound(@MessageBody() data: { pin: string }) {
    const round = await this.roundService.getNext(data.pin);
    if (round) {
      this.server.emit('newRound', { roundId: round.id });
    } else {
      this.server.emit('goToResult');
    }
  }
}
