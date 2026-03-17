import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import * as Sentry from '@sentry/nestjs';
import { Server } from 'socket.io';

@WebSocketGateway()
export class RoundGateway {
  @WebSocketServer() server: Server;

  emitThemeUpdated(pin: string) {
    Sentry.logger.info('Theme update emitted', { pin });
    this.server.to(pin).emit('round:themeUpdated');
  }

  emitRoundCompleted(pin: string, nextRoundId?: number) {
    Sentry.logger.info('Round completed event emitted', { pin, nextRoundId: nextRoundId ?? null, isGameOver: !nextRoundId });
    this.server.to(pin).emit('round:completed', { nextRoundId });
  }
}
