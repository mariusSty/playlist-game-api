import { Test, TestingModule } from '@nestjs/testing';
import { SharedGateway } from './shared.gateway';

describe('SharedGateway', () => {
  let gateway: SharedGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SharedGateway],
    }).compile();

    gateway = module.get<SharedGateway>(SharedGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
