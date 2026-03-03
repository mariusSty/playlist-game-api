import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class RoundGateway {
  @WebSocketServer() server: Server;

  emitThemeUpdated(pin: string) {
    this.server.to(pin).emit('round:themeUpdated');
  }
}
