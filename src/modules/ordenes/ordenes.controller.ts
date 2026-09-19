import { Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';

@Controller('ordenes')
export class OrdenesController {
    constructor(private readonly ordenesService: OrdenesService) { }

    @Post('nueva')
    async registrarOrden(@Body() body: any) {
        return await this.ordenesService.crearOrden(body);
    }

    @Get(':id')
    async obtenerOrdenCompleta(@Param('id') id: string) {
        return await this.ordenesService.obtenerOrden(id);
    }

    @Patch(':id/pago')
    async registrarNuevoPago(
        @Param('id') id: string,
        @Body('monto') monto: number,
    ) {
        return await this.ordenesService.registrarPago(id, monto);
    }
}