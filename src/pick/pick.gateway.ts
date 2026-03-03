import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class PickGateway {
  @WebSocketServer() server: Server;

  emitPickUpdated(pin: string, users: string[]) {
    this.server.to(pin).emit('pick:updated', { users });
  }
}
