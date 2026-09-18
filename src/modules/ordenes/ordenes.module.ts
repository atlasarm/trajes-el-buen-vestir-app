import { Module } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';
import { OrdenesController } from './ordenes.controller';

@Module({
  providers: [OrdenesService],
  controllers: [OrdenesController]
})
export class OrdenesModule {}
