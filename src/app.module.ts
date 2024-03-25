import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoomModule } from './room/room.module';
import { UserService } from './user/user.service';
import { GameModule } from './game/game.module';
import { ThemeController } from './theme/theme.controller';

@Module({
  imports: [RoomModule, GameModule],
  controllers: [AppController, ThemeController],
  providers: [AppService, PrismaService, UserService],
})
export class AppModule {}
