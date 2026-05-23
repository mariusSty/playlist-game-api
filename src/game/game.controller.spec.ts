import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma.service';
import { RoomService } from 'src/room/room.service';
import { SessionGateway } from 'src/session/session.gateway';
import { GameController } from './game.controller';
import { GameService } from './game.service';

describe('GameController', () => {
  let controller: GameController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        GameService,
        { provide: PrismaService, useValue: { client: {} } },
        { provide: RoomService, useValue: {} },
        { provide: SessionGateway, useValue: { emitSessionUpdated: jest.fn() } },
      ],
    }).compile();

    controller = module.get<GameController>(GameController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
