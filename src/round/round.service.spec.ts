import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma.service';
import { RoundService } from './round.service';

describe('RoundService', () => {
  let service: RoundService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoundService,
        { provide: PrismaService, useValue: { client: {} } },
      ],
    }).compile();

    service = module.get<RoundService>(RoundService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
