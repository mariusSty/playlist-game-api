import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import * as Sentry from '@sentry/nestjs';
import { Server } from 'socket.io';

@WebSocketGateway()
export class GameGateway {
  @WebSocketServer() server: Server;

  emitGameStateChanged(pin: string) {
    Sentry.logger.info('Game state changed event emitted', { pin });
    this.server.to(pin).emit('game:stateChanged');
  }

  emitRoomStateChanged(pin: string) {
    Sentry.logger.info('Room state changed event emitted (from game)', { pin });
    this.server.to(pin).emit('room:stateChanged');
  }
}
