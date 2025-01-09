import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game/game.module';
import { RoomModule } from './room/room.module';
import { ThemeController } from './theme/theme.controller';
import { UserService } from './user/user.service';
import { GuessService } from './guess/guess.service';

@Module({
  imports: [RoomModule, GameModule],
  controllers: [AppController, ThemeController],
  providers: [AppService, PrismaService, UserService, GuessService],
})
export class AppModule {}
