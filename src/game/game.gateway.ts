import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class GameGateway {
  @WebSocketServer() server: Server;

  emitGameStarted(
    pin: string,
    data: { roundId: number; gameId: number; pin: string },
  ) {
    this.server.to(pin).emit('game:started', data);
  }
}
