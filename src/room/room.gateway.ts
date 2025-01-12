import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { GameService } from 'src/game/game.service';
import { RoomService } from 'src/room/room.service';

@WebSocketGateway({ namespace: 'rooms' })
export class RoomGateway {
  @WebSocketServer() server: Server;

  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
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
    this.server.emit('gameStarted');
  }

  @SubscribeMessage('pickTheme')
  async handlePickTheme(
    @MessageBody() data: { roundId: number; theme: string },
  ) {
    await this.gameService.updateRound(Number(data.roundId), data.theme);
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
    await this.gameService.assignSong(data);
    const picks = await this.gameService.countPicksByRoundId(data.roundId);
    const room = await this.roomService.findOne(data.pin);
    const allValidated = room.users.length === picks;
    if (allValidated) {
      const pick = await this.gameService.getPickWithoutVotes(data.pin);
      this.server.emit('songValidated', {
        pickId: pick.id,
      });
    }
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
    await this.gameService.createVote(data);
    const votes = await this.gameService.countVotesByPickId(
      Number(data.pickId),
    );
    const room = await this.roomService.findOne(data.pin);
    const allVoted = room.users.length === votes;
    if (allVoted) {
      const pick = await this.gameService.getPickWithoutVotes(data.pin);
      this.server.emit('voteValidated', {
        pickId: pick ? pick.id : null,
      });
    }
  }
}
