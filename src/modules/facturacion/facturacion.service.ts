import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';
import { CreateFacturaDto } from './dto/factura.dto';
import { SriService } from '../sri/sri.service';
import { FacturaSRIDto } from '../sri/sri.interface';

@Injectable()
export class FacturacionService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly sriService: SriService
    ) { }

    async obtenerTodas(page: number = 1, limit: number = 10, search?: string) {
        const supabase = this.supabaseService.getClient();
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('facturacion')
            .select('*, clientes!inner(nombres, apellidos, cedula_ruc), ordenes_pedido(numero_orden)', { count: 'exact' });

        if (search) {
            query = query.or(`clientes.cedula_ruc.ilike.%${search}%,clientes.nombres.ilike.%${search}%,clientes.apellidos.ilike.%${search}%`);
        }

        const { data, count, error } = await query.order('fecha_emision', { ascending: false }).range(from, to);

        if (error) throw new InternalServerErrorException('Error al consultar facturas.');

        return {
            data,
            meta: { total: count, page, limit, totalPages: Math.ceil((count || 0) / limit) }
        };
    }

    async emitirFactura(dto: CreateFacturaDto) {
        const supabase = this.supabaseService.getClient();

        const { data: orden, error: errOrden } = await supabase
            .from('ordenes_pedido')
            .select('*, clientes(*), orden_detalles(*)')
            .eq('id', dto.orden_id)
            .single();

        if (errOrden || !orden) throw new NotFoundException('Orden de pedido no encontrada.');
        if (orden.estado === 'Anulada') throw new BadRequestException('No se puede facturar una orden anulada.');
        if (orden.factura_id) throw new BadRequestException('Esta orden ya tiene una factura emitida.');

        const subtotal = orden.subtotal;
        const iva = 0;
        const total = subtotal;

        const { data: factura, error: errFactura } = await supabase
            .from('facturacion')
            .insert([{
                cliente_id: orden.cliente_id,
                orden_id: orden.id,
                subtotal,
                iva,
                total,
                metodo_pago: dto.metodo_pago || 'Efectivo',
                estado_sri: 'PROCESANDO'
            }])
            .select()
            .single();

        if (errFactura) throw new InternalServerErrorException(`Error al guardar la factura local: ${errFactura.message}`);

        await supabase.from('ordenes_pedido').update({ factura_id: factura.id }).eq('id', orden.id);

        const identificacion = orden.clientes.cedula_ruc;
        const tipoIdentificacion = identificacion.length === 13 ? '04' : (identificacion.length === 10 ? '05' : '06');

        const sriDto: FacturaSRIDto = {
            secuencial: factura.numero_factura.toString().padStart(9, '0'),
            cliente: {
                tipoIdentificacion,
                razonSocial: `${orden.clientes.nombres} ${orden.clientes.apellidos}`.trim(),
                identificacion: identificacion,
                direccion: orden.clientes.direccion || 'Quito, Ecuador'
            },
            subtotal: subtotal,
            items: orden.orden_detalles.map((detalle: any, index: number) => ({
                codigoPrincipal: `P-${(index + 1).toString().padStart(3, '0')}`,
                descripcion: detalle.descripcion,
                cantidad: detalle.cantidad,
                precioUnitario: detalle.precio_unitario,
                descuento: 0
            }))
        };

        try {
            const resultadoSri = await this.sriService.procesarFacturaElectronica(sriDto);
            
            await supabase.from('facturacion').update({
                estado_sri: resultadoSri.exito ? 'AUTORIZADO' : 'RECHAZADO',
                clave_acceso: resultadoSri.claveAcceso,
                xml_autorizado: resultadoSri.xmlAutorizado
            }).eq('id', factura.id);
            
            return { ...factura, sri: resultadoSri };
        } catch (sriError) {
            console.error("Fallo de comunicación con el SRI:", sriError);
            await supabase.from('facturacion').update({ estado_sri: 'ERROR_CONEXION' }).eq('id', factura.id);
            return { ...factura, sri: { exito: false, mensaje: 'Registrada localmente, pendiente de conexión con el SRI.' } };
        }
    }
}