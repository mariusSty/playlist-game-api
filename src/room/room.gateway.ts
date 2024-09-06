import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { RoomService } from 'src/room/room.service';

@WebSocketGateway({ namespace: 'rooms' })
export class RoomGateway {
  @WebSocketServer() server: Server;

  constructor(private readonly roomService: RoomService) {}

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() data: { roomCode: string }) {
    const { roomCode } = data;
    this.sendUserList(roomCode);
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() data: { roomCode: string; userId: string },
  ) {
    const { roomCode, userId } = data;
    await this.roomService.disconnect(roomCode, userId);
    this.sendUserList(roomCode);
  }

  private async sendUserList(roomCode: string) {
    const room = await this.roomService.findOne(roomCode);
    this.server.emit('userList', { users: room.users });
  }
}
