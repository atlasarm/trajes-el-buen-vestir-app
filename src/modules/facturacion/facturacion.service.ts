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
            .from('facturas')
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

        // 1. Obtener datos del cliente
        const { data: cliente, error: errCliente } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', dto.cliente_id)
            .single();

        if (errCliente || !cliente) throw new NotFoundException('Cliente no encontrado.');

        // 2. Calcular valores
        const subtotal = dto.detalles.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario), 0);
        const iva = 0; 
        const total = subtotal;

        // 3. Crear cabecera en BD usando los nombres exactos de tu tabla
        const { data: factura, error: errFactura } = await supabase
            .from('facturas')
            .insert([{
                cliente_id: dto.cliente_id,
                orden_id: dto.orden_id || null, 
                subtotal_factura: subtotal,
                iva_aplicado: iva,
                total_factura: total,
                metodo_pago: dto.metodo_pago || 'Efectivo',
                estado_sri: 'PROCESANDO'
            }])
            .select()
            .single();

        if (errFactura) throw new InternalServerErrorException(`Error al guardar factura: ${errFactura.message}`);

        // 4. Guardar los ítems en la tabla factura_detalles
        const detallesInsert = dto.detalles.map((d: any) => ({
            factura_id: factura.id,
            descripcion: d.descripcion,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario
        }));
        await supabase.from('factura_detalles').insert(detallesInsert);

        // 5. Bloquear la orden si existe
        if (dto.orden_id) {
            await supabase.from('ordenes_pedido').update({ factura_id: factura.id }).eq('id', dto.orden_id);
        }

        // 6. Preparar datos SRI
        const identificacion = cliente.cedula_ruc;
        const tipoIdentificacion = identificacion.length === 13 ? '04' : (identificacion.length === 10 ? '05' : '06');
        
        // Formatear secuencial auto-generado a 9 ceros para el SRI (Ej: 000000015)
        const secuencialFormateado = (factura.secuencial_local || 1).toString().padStart(9, '0');

        const sriDto: FacturaSRIDto = {
            secuencial: secuencialFormateado,
            cliente: {
                tipoIdentificacion,
                razonSocial: `${cliente.nombres} ${cliente.apellidos}`.trim(),
                identificacion: identificacion,
                direccion: cliente.direccion || 'Quito, Ecuador'
            },
            subtotal: subtotal,
            items: dto.detalles.map((detalle: any, index: number) => ({
                codigoPrincipal: `P-${(index + 1).toString().padStart(3, '0')}`,
                descripcion: detalle.descripcion,
                cantidad: detalle.cantidad,
                precioUnitario: detalle.precio_unitario,
                descuento: 0
            }))
        };

        // 7. Enviar al SRI y actualizar
        try {
            const resultadoSri = await this.sriService.procesarFacturaElectronica(sriDto);
            
            await supabase.from('facturas').update({
                estado_sri: resultadoSri.exito ? 'AUTORIZADO' : 'RECHAZADO',
                numero_factura_sri: secuencialFormateado,
                clave_acceso_sri: resultadoSri.claveAcceso,
                xml_url: resultadoSri.xmlAutorizado 
            }).eq('id', factura.id);
            
            return { ...factura, sri: resultadoSri };
        } catch (sriError) {
            await supabase.from('facturas').update({ estado_sri: 'ERROR_CONEXION' }).eq('id', factura.id);
            return { ...factura, sri: { exito: false, mensaje: 'Registrada localmente, falló conexión con SRI.' } };
        }
    }
}