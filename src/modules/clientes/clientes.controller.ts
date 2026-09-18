import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ClientesService } from './clientes.service';

@Controller('clientes')
export class ClientesController {
    constructor(private readonly clientesService: ClientesService) { }

    @Get('buscar/:cedula')
    async buscarCliente(@Param('cedula') cedula: string) {
        return await this.clientesService.buscarPorCedula(cedula);
    }

    @Post('nuevo')
    async registrarCliente(@Body() body: any) {
        // TODO: Añadir DTOs
        return await this.clientesService.crearCliente(body);
    }
}