import { Controller, Post, Body } from '@nestjs/common';
import { FacturacionService } from './facturacion.service';

@Controller('facturacion')
export class FacturacionController {
    constructor(private readonly facturacionService: FacturacionService) {}

    @Post('libre')
    async facturarVentaDirecta(@Body() datosVenta: any) {
        return await this.facturacionService.generarFacturaLibre(datosVenta);
    }

    @Post('ordenes')
    async facturarDesdeOrdenes(@Body('ordenIds') ordenIds: string[]) {
        return await this.facturacionService.generarFacturaDesdeOrdenes(ordenIds);
    }
}