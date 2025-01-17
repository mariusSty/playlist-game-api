import { Test, TestingModule } from '@nestjs/testing';
import { MusicApiService } from './musicapi.service';

describe('MusicApiService', () => {
  let service: MusicApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MusicApiService],
    }).compile();

    service = module.get<MusicApiService>(MusicApiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
