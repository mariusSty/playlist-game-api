import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from 'src/game/game.service';
import { PrismaService } from 'src/prisma.service';
import { SessionGateway } from 'src/session/session.gateway';
import { UserService } from 'src/user/user.service';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';

describe('RoomController', () => {
  let controller: RoomController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomController],
      providers: [
        RoomService,
        { provide: PrismaService, useValue: { client: {} } },
        { provide: UserService, useValue: {} },
        { provide: SessionGateway, useValue: { emitSessionUpdated: jest.fn() } },
        { provide: GameService, useValue: {} },
      ],
    }).compile();

    controller = module.get<RoomController>(RoomController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
