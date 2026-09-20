import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ClientesService } from './clientes.service';

@Controller('clientes')
export class ClientesController {
    constructor(private readonly clientesService: ClientesService) { }

    @Get()
    async obtenerTodos() {
        return this.clientesService.obtenerTodos();
    }

    @Get('buscar/:cedula')
    async buscarCliente(@Param('cedula') cedula: string) {
        return await this.clientesService.buscarPorCedula(cedula);
    }

    @Post()
    async registrarCliente(@Body() body: any) {
        // TODO: Añadir DTOs
        return await this.clientesService.crearCliente(body);
    }

    @Patch(':id')
    async actualizar(@Param('id') id: string, @Body() cliente: any) {
        return this.clientesService.actualizar(id, cliente);
    }

    @Delete(':id')
    async eliminar(@Param('id') id: string) {
        return this.clientesService.eliminar(id);
    }
}