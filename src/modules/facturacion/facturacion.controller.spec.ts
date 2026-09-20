import { Test, TestingModule } from '@nestjs/testing';
import { FacturacionController } from './facturacion.controller';

describe('FacturacionController', () => {
  let controller: FacturacionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FacturacionController],
    }).compile();

    controller = module.get<FacturacionController>(FacturacionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
