import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import * as Sentry from '@sentry/nestjs';
import { Server, Socket } from 'socket.io';
import { RoomService } from 'src/room/room.service';

@WebSocketGateway()
export class SessionGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private userSockets = new Map<string, Set<string>>();

  constructor(private readonly roomService: RoomService) {}

  @SubscribeMessage('session:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pin: string; userId: string },
  ) {
    const room = await this.roomService.findOne(data.pin);
    if (!room) return;

    const isMember = room.users.some((u) => u.id === data.userId);
    if (!isMember) return;

    Sentry.logger.info('Player subscribed to session channel', {
      pin: data.pin,
      userId: data.userId,
    });

    client.join(data.pin);

    if (!this.userSockets.has(data.userId)) {
      this.userSockets.set(data.userId, new Set());
    }
    this.userSockets.get(data.userId).add(client.id);
  }

  @SubscribeMessage('session:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pin: string; userId: string },
  ) {
    Sentry.logger.info('Player unsubscribed from session channel', {
      pin: data.pin,
      userId: data.userId,
    });
    client.leave(data.pin);
  }

  handleDisconnect(client: Socket) {
    Sentry.logger.info('Client disconnected', { socketId: client.id });
    for (const [userId, socketIds] of this.userSockets.entries()) {
      socketIds.delete(client.id);
      if (socketIds.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  emitSessionUpdated(pin: string) {
    Sentry.logger.info('Session updated event emitted', { pin });
    this.server.to(pin).emit('session:updated');
  }
}
