import { Controller, Post, Body, Get, Param, Patch, Delete, Query } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';
import { CreateOrdenDto } from './dto/orden.dto';

@Controller('ordenes')
export class OrdenesController {
    constructor(private readonly ordenesService: OrdenesService) { }

    @Get()
    async obtenerTodas(
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('search') search: string
    ) {
        return await this.ordenesService.obtenerTodos(Number(page) || 1, Number(limit) || 10, search);
    }

    @Post('nueva')
    async registrarOrden(@Body() body: CreateOrdenDto) {
        return await this.ordenesService.crearOrden(body);
    }

    @Get(':id')
    async obtenerOrdenCompleta(@Param('id') id: string) {
        return await this.ordenesService.obtenerOrden(id);
    }

    @Patch(':id/editar')
    async modificarOrden(
        @Param('id') id: string,
        @Body() body: CreateOrdenDto,
    ) {
        return await this.ordenesService.actualizarOrden(id, body);
    }

    @Patch(':id/pago')
    async registrarNuevoPago(
        @Param('id') id: string,
        @Body('monto') monto: number,
    ) {
        return await this.ordenesService.registrarPago(id, monto);
    }

    @Delete(':id')
    async anularOrden(@Param('id') id: string) {
        return await this.ordenesService.eliminarOrden(id);
    }
}