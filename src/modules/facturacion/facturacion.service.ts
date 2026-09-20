import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';
import { SriService } from '../sri/sri.service';
import { FacturaSRIDto, ItemFacturaSRI } from '../sri/sri.interface';

@Injectable()
export class FacturacionService {
    constructor(
        private supabaseService: SupabaseService,
        private sriService: SriService
    ) {}

    private async obtenerSiguienteSecuencial(): Promise<string> {
        return '000000002'; 
    }

    // Facturación Libre (Ventas directas, sin orden previa)
    async generarFacturaLibre(datosVenta: any) {
        const secuencial = await this.obtenerSiguienteSecuencial();

        // Construir el DTO estandarizado
        const facturaDto: FacturaSRIDto = {
            secuencial: secuencial,
            subtotal: datosVenta.subtotal,
            cliente: {
                razonSocial: datosVenta.cliente.nombreCompleto,
                identificacion: datosVenta.cliente.identificacion,
                tipoIdentificacion: datosVenta.cliente.identificacion.length === 13 ? '04' : '05',
                direccion: datosVenta.cliente.direccion || 'Quito, Ecuador'
            },
            items: datosVenta.items.map((item: any, index: number) => ({
                codigoPrincipal: item.codigoPrincipal || `VD-${index + 1}`,
                descripcion: item.descripcion,
                cantidad: item.cantidad,
                precioUnitario: item.precioUnitario,
                descuento: item.descuento || 0
            }))
        };

        // Enviar al motor del SRI
        const resultadoSRI = await this.sriService.procesarFacturaElectronica(facturaDto);

        return {
            origen: 'Venta Directa',
            ...resultadoSRI
        };
    }

    // Facturar a partir de 1 o Múltiples Órdenes de Pedido
    async generarFacturaDesdeOrdenes(ordenIds: string[]) {
        if (!ordenIds || ordenIds.length === 0) {
            throw new BadRequestException('Debe proporcionar al menos un ID de orden de pedido.');
        }

        const supabase = this.supabaseService.getClient();

        // Extraer todas las órdenes con sus clientes y detalles
        const { data: ordenes, error } = await supabase
            .from('ordenes_pedido')
            .select(`
                *,
                clientes (nombres, apellidos, cedula_ruc, telefono, direccion, correo),
                orden_detalles (*)
            `)
            .in('id', ordenIds);

        if (error || !ordenes || ordenes.length === 0) {
            throw new NotFoundException('No se encontraron las órdenes solicitadas.');
        }

        const secuencial = await this.obtenerSiguienteSecuencial();

        // Consolidar datos: Se toma al cliente de la primera orden como titular
        const clientePrincipal = ordenes[0].clientes;
        let subtotalGlobal = 0;
        let itemsGlobales: ItemFacturaSRI[] = [];

        ordenes.forEach((orden) => {
            subtotalGlobal += orden.subtotal;
            
            const itemsOrden = orden.orden_detalles.map((item: any, index: number) => ({
                codigoPrincipal: `ORD-${orden.id.split('-')[0]}-${index + 1}`,
                descripcion: item.descripcion,
                cantidad: item.cantidad,
                precioUnitario: item.precio_unitario,
                descuento: 0 
            }));

            itemsGlobales = [...itemsGlobales, ...itemsOrden];
        });

        // Construir el DTO estandarizado para el SRI
        const facturaDto: FacturaSRIDto = {
            secuencial: secuencial,
            subtotal: subtotalGlobal,
            cliente: {
                razonSocial: `${clientePrincipal.nombres} ${clientePrincipal.apellidos}`,
                identificacion: clientePrincipal.cedula_ruc,
                tipoIdentificacion: clientePrincipal.cedula_ruc.length === 13 ? '04' : '05',
                direccion: clientePrincipal.direccion || 'Quito, Ecuador'
            },
            items: itemsGlobales
        };

        // Enviar al motor del SRI
        const resultadoSRI = await this.sriService.procesarFacturaElectronica(facturaDto);

        // Si el SRI autoriza, se actualiza el estado de TODAS las órdenes en Supabase
        if (resultadoSRI.exito) {
            const { error: updateError } = await supabase
                .from('ordenes_pedido')
                .update({
                    estado: 'Facturada',
                    clave_acceso_sri: resultadoSRI.claveAcceso,
                    fecha_facturacion: new Date().toISOString()
                })
                .in('id', ordenIds);

            if (updateError) {
                console.error('Alerta: Falló la actualización múltiple en Supabase:', updateError.message);
            }
        }

        return {
            origen: 'Órdenes de Pedido Consolidadas',
            ordenes_procesadas: ordenIds,
            ...resultadoSRI
        };
    }
}