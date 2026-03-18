import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import * as Sentry from '@sentry/nestjs';
import { Server } from 'socket.io';

@WebSocketGateway()
export class VoteGateway {
  @WebSocketServer() server: Server;

  emitGameStateChanged(pin: string) {
    Sentry.logger.info('Game state changed event emitted (from vote)', { pin });
    this.server.to(pin).emit('game:stateChanged');
  }
}
