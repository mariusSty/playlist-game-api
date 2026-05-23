import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma.service';
import { SessionGateway } from 'src/session/session.gateway';
import { RoundController } from './round.controller';
import { RoundService } from './round.service';

describe('RoundController', () => {
  let controller: RoundController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoundController],
      providers: [
        RoundService,
        { provide: PrismaService, useValue: { client: {} } },
        { provide: SessionGateway, useValue: { emitSessionUpdated: jest.fn() } },
      ],
    }).compile();

    controller = module.get<RoundController>(RoundController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
