import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import * as Sentry from '@sentry/nestjs';
import { Server } from 'socket.io';

@WebSocketGateway()
export class GameGateway {
  @WebSocketServer() server: Server;

  emitGameStarted(
    pin: string,
    data: { roundId: number; gameId: number; pin: string },
  ) {
    Sentry.logger.info('Game started event emitted', { pin, gameId: data.gameId, firstRoundId: data.roundId });
    this.server.to(pin).emit('game:started', data);
  }
}
