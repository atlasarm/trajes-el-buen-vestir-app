import { Controller, Post, Body } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';

@Controller('ordenes')
export class OrdenesController {
    constructor(private readonly ordenesService: OrdenesService) { }

    @Post('nueva')
    async registrarOrden(@Body() body: any) {
        return await this.ordenesService.crearOrden(body);
    }
}