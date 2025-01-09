import { ParseIntPipe } from '@nestjs/common';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { AssignSongDto } from 'src/game/dto/create-game.dto';
import { GameService } from 'src/game/game.service';
import { GuessService } from 'src/guess/guess.service';
import { RoomService } from 'src/room/room.service';

@WebSocketGateway({ namespace: 'rooms' })
export class RoomGateway {
  @WebSocketServer() server: Server;

  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
    private readonly guessService: GuessService,
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
  async handleStartGame(@MessageBody() data: { pin: string }) {
    const room = await this.roomService.findOne(data.pin);
    await this.gameService.create({
      pin: room.pin,
      userId: room.hostId,
    });
    this.server.emit('gameStarted');
  }

  @SubscribeMessage('pickTheme')
  async handlePickTheme(
    @MessageBody() data: { roundId: number; themeId: number },
  ) {
    await this.gameService.assignTheme(data);
    this.server.emit('themePicked', { roundId: data.roundId });
  }

  @SubscribeMessage('validSong')
  async handleValidSong(@MessageBody() data: AssignSongDto) {
    await this.gameService.assignSong(data);
    const round = await this.gameService.getRound(data.roundId);
    const totalUsersValidated = await this.gameService.countUsersValidatedSong(
      data.roundId,
    );
    if (totalUsersValidated === round.game.room.users.length) {
      this.server.emit('nextRound', { roundId: data.roundId });
    }
  }

  @SubscribeMessage('vote')
  async handleVote(
    @MessageBody('guessId') guessId: string,
    @MessageBody('userId') userId: string,
    @MessageBody('roundId', ParseIntPipe) roundId: number,
  ) {
    await this.guessService.create({ guessId, userId, roundId });
    const totalVotes = await this.guessService.countByRoundId(roundId);
    const round = await this.gameService.getRound(roundId);
    if (totalVotes === round.game.room.users.length) {
      this.server.emit('userVoted', { roundId });
    }
  }
}
