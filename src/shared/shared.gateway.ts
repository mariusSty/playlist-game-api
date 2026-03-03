import {
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from 'src/game/game.service';
import { RoundService } from 'src/round/round.service';

@WebSocketGateway()
export class SharedGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly gameService: GameService,
    private readonly roundService: RoundService,
  ) {}

  async handleDisconnect(client: Socket) {
    // Socket.IO rooms are cleaned up automatically on disconnect
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
