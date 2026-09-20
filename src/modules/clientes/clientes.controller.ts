import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';

@Controller('clientes')
export class ClientesController {
    constructor(private readonly clientesService: ClientesService) { }

    @Get()
    async obtenerTodos(
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('search') search: string
    ) {
        return this.clientesService.obtenerTodos(Number(page) || 1, Number(limit) || 10, search);
    }

    @Get('buscar/:cedula')
    async buscarCliente(@Param('cedula') cedula: string) {
        return await this.clientesService.buscarPorCedula(cedula);
    }

    @Post()
    async registrarCliente(@Body() body: CreateClienteDto) {
        return await this.clientesService.crearCliente(body);
    }

    @Patch(':id')
    async actualizar(@Param('id') id: string, @Body() cliente: UpdateClienteDto) {
        return this.clientesService.actualizar(id, cliente);
    }

    @Delete(':id')
    async eliminar(@Param('id') id: string) {
        return this.clientesService.eliminar(id);
    }
}