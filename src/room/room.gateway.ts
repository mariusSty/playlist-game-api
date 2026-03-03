import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomService } from './room.service';

@WebSocketGateway()
export class RoomGateway {
  @WebSocketServer() server: Server;

  constructor(private readonly roomService: RoomService) {}

  @SubscribeMessage('room:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pin: string; userId: string },
  ) {
    const room = await this.roomService.findOne(data.pin);
    if (!room) return;

    const isMember = room.users.some((u) => u.id === data.userId);
    if (!isMember) return;

    client.join(data.pin);
  }

  @SubscribeMessage('room:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pin: string },
  ) {
    client.leave(data.pin);
  }

  emitRoomUpdated(pin: string, users: any[], hostId: string) {
    this.server.to(pin).emit('room:updated', {
      users,
      hostId,
      pin,
    });
  }
}
