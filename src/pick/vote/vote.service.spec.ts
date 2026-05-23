import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma.service';
import { VoteService } from './vote.service';

describe('VoteService', () => {
  let service: VoteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoteService,
        { provide: PrismaService, useValue: { client: {} } },
      ],
    }).compile();

    service = module.get<VoteService>(VoteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
