import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import * as Sentry from '@sentry/nestjs';
import { Server } from 'socket.io';

@WebSocketGateway()
export class PickGateway {
  @WebSocketServer() server: Server;

  emitPickUpdated(pin: string, users: string[], firstPickId?: number) {
    Sentry.logger.info('Pick update emitted', { pin, pickedCount: users.length, allPicked: !!firstPickId, firstPickId: firstPickId ?? null });
    this.server.to(pin).emit('pick:updated', { users, firstPickId });
  }
}
