import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class VoteGateway {
  @WebSocketServer() server: Server;

  emitVoteUpdated(pin: string, users: string[], nextPickId?: number | null) {
    this.server.to(pin).emit('vote:updated', { users, nextPickId });
  }
}
