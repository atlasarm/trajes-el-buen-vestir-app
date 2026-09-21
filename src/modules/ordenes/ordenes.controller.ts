import { Controller, Post, Body, Get, Param, Patch, Query } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';

@Controller('ordenes')
export class OrdenesController {
    constructor(private readonly ordenesService: OrdenesService) { }

    @Get()
    async obtenerTodas(
        @Query('page') page: string,
        @Query('limit') limit: string
    ) {
        return await this.ordenesService.obtenerTodos(Number(page) || 1, Number(limit) || 10);
    }
    
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