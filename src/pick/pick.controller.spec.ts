import { Test, TestingModule } from '@nestjs/testing';
import { MusicApiService } from 'src/pick/musicapi.service';
import { PrismaService } from 'src/prisma.service';
import { SessionGateway } from 'src/session/session.gateway';
import { PickController } from './pick.controller';
import { PickService } from './pick.service';

describe('PickController', () => {
  let controller: PickController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PickController],
      providers: [
        PickService,
        { provide: PrismaService, useValue: { client: {} } },
        { provide: MusicApiService, useValue: {} },
        { provide: SessionGateway, useValue: { emitSessionUpdated: jest.fn() } },
      ],
    }).compile();

    controller = module.get<PickController>(PickController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
