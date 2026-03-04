import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { PrismaModule } from 'src/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game/game.module';
import { HealthModule } from './health/health.module';
import { PickModule } from './pick/pick.module';
import { RoomModule } from './room/room.module';
import { RoundModule } from './round/round.module';
import { UserService } from './user/user.service';

@Module({
  imports: [
    SentryModule.forRoot(),
    PrismaModule,
    HealthModule,
    RoomModule,
    GameModule,
    RoundModule,
    PickModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    AppService,
    UserService,
  ],
})
export class AppModule {}
