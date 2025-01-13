import { Test, TestingModule } from '@nestjs/testing';
import { PickController } from './pick.controller';
import { PickService } from './pick.service';

describe('PickController', () => {
  let controller: PickController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PickController],
      providers: [PickService],
    }).compile();

    controller = module.get<PickController>(PickController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
