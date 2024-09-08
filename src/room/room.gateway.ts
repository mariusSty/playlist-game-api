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
  async handleJoinRoom(@MessageBody() data: { roomCode: string }) {
    const { roomCode } = data;
    const room = await this.roomService.findOne(roomCode);
    this.server.emit('userList', { users: room.users, hostId: room.hostId });
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() data: { roomCode: string; userId: string },
  ) {
    const { roomCode, userId } = data;
    const room = await this.roomService.findOne(roomCode);
    let hostId = room.hostId;
    if (room.users.length === 1) {
      return this.roomService.remove(room.id);
    }
    if (room.hostId === userId) {
      const newHostId = room.users.find((user) => user.id !== userId)?.id;
      await this.roomService.updateHost(roomCode, newHostId);
      hostId = newHostId;
    }
    await this.roomService.disconnect(roomCode, userId);
    this.server.emit('userList', {
      users: room.users.filter((user) => user.id !== userId),
      hostId,
    });
  }
}
