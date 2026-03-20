import { Global, Module } from '@nestjs/common';
import { RoomModule } from 'src/room/room.module';
import { SessionGateway } from './session.gateway';

@Global()
@Module({
  imports: [RoomModule],
  providers: [SessionGateway],
  exports: [SessionGateway],
})
export class SessionModule {}
