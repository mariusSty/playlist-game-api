import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import * as Sentry from '@sentry/nestjs';
import { Server } from 'socket.io';

@WebSocketGateway()
export class VoteGateway {
  @WebSocketServer() server: Server;

  emitVoteUpdated(pin: string, users: string[], nextPickId?: number | null) {
    const allVoted = nextPickId !== undefined;
    Sentry.logger.info('Vote update emitted', { pin, voterCount: users.length, allVoted, nextPickId: nextPickId ?? null });
    this.server.to(pin).emit('vote:updated', { users, nextPickId });
  }
}
