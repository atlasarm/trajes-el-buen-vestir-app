import { Module } from '@nestjs/common';
import { FacturacionService } from './facturacion.service';
import { FacturacionController } from './facturacion.controller';
import { SriModule } from '../sri/sri.module';

@Module({
    imports: [SriModule],
    providers: [FacturacionService],
    controllers: [FacturacionController]
})
export class FacturacionModule { }
