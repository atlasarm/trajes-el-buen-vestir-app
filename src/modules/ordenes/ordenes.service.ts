import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';
import { CreateOrdenDto } from './dto/orden.dto';

@Injectable()
export class OrdenesService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async obtenerTodos(page: number = 1, limit: number = 10, search?: string) {
        const supabase = this.supabaseService.getClient();
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        let query = supabase
            .from('ordenes_pedido')
            .select('*, clientes!inner(nombres, apellidos, cedula_ruc)', { count: 'exact' });

        if (search) {
            const cleanSearch = search.replace(/^ord-?/i, '');
            const isNumeric = /^\d+$/.test(cleanSearch);
            
            if (isNumeric) {
                if (cleanSearch.length >= 10) {
                    query = query.eq('clientes.cedula_ruc', cleanSearch);
                } else {
                    query = query.eq('numero_orden', parseInt(cleanSearch, 10));
                }
            } else {
                query = query.or(`nombres.ilike.%${cleanSearch}%,apellidos.ilike.%${cleanSearch}%`, { foreignTable: 'clientes' });
            }
        }

        const { data, count, error } = await query
            .order('fecha_creacion', { ascending: false })
            .range(from, to);

        if (error) {
            throw new InternalServerErrorException('Error al consultar el historial de órdenes.');
        }

        return {
            data,
            meta: { 
                total: count, 
                page, 
                limit, 
                totalPages: Math.ceil((count || 0) / limit) 
            }
        };
    }

    async crearOrden(ordenData: CreateOrdenDto) {
        const supabase = this.supabaseService.getClient();
        const { cliente_id, fecha_entrega_estimada, abono = 0, detalles } = ordenData;

        // Calcular subtotal de la orden
        const subtotalCalculado = detalles.reduce(
            (suma, item) => suma + (item.cantidad * item.precio_unitario),
            0,
        );

        // Insertar la Cabecera de la Orden
        const { data: orden, error: ordenError } = await supabase
            .from('ordenes_pedido')
            .insert([{
                cliente_id,
                fecha_entrega_estimada,
                subtotal: subtotalCalculado,
                abono: abono || 0,
                estado: 'Pendiente'
            }])
            .select()
            .single();

        if (ordenError) throw new InternalServerErrorException(`Error al crear orden: ${ordenError.message}`);

        const detallesParaInsertar = detalles.map((item) => ({
            orden_id: orden.id,
            tipo_item: item.tipo_item,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            imagen_referencia_url: item.imagen_referencia_url,
        }));

        const { error: detallesError } = await supabase
            .from('orden_detalles')
            .insert(detallesParaInsertar);

        if (detallesError) {
            await supabase.from('ordenes_pedido').delete().eq('id', orden.id);
            throw new InternalServerErrorException('Error al insertar los detalles. Orden revertida por seguridad.');
        }

        return orden;
    }

    async obtenerOrden(id: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('ordenes_pedido')
            .select(`
                *,
                clientes (nombres, apellidos, cedula_ruc, telefono),
                orden_detalles (*)
            `)
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException(`No se encontró la orden o hubo un error: ${error?.message}`);
        }

        return data;
    }

    async actualizarOrden(id: string, ordenData: CreateOrdenDto) {
        const supabase = this.supabaseService.getClient();
        const { fecha_entrega_estimada, abono, detalles } = ordenData;

        const subtotalCalculado = detalles.reduce(
            (suma, item) => suma + (item.cantidad * item.precio_unitario),
            0,
        );

        const { error: cabeceraError } = await supabase
            .from('ordenes_pedido')
            .update({ 
                fecha_entrega_estimada, 
                abono: abono || 0, 
                subtotal: subtotalCalculado 
            })
            .eq('id', id);

        if (cabeceraError) throw new InternalServerErrorException('Error al actualizar la cabecera de la orden.');

        await supabase.from('orden_detalles').delete().eq('orden_id', id);

        const detallesParaInsertar = detalles.map((item) => ({
            orden_id: id,
            tipo_item: item.tipo_item,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            imagen_referencia_url: item.imagen_referencia_url,
        }));

        const { error: detallesError } = await supabase.from('orden_detalles').insert(detallesParaInsertar);

        if (detallesError) throw new InternalServerErrorException('Error al actualizar los detalles de la orden.');

        return { mensaje: 'Orden actualizada exitosamente' };
    }

    async eliminarOrden(id: string) {
        const supabase = this.supabaseService.getClient();

        const { data: orden, error: errorBusqueda } = await supabase
            .from('ordenes_pedido')
            .select('id, factura_id')
            .eq('id', id)
            .single();

        if (errorBusqueda || !orden) {
            throw new NotFoundException('La orden no existe o ya fue eliminada.');
        }

        if (orden.factura_id) {
            throw new InternalServerErrorException('No se puede eliminar esta orden porque ya tiene una factura asociada.');
        }

        const { error: errorDelete } = await supabase
            .from('ordenes_pedido')
            .delete()
            .eq('id', id);

        if (errorDelete) {
            if (errorDelete.code === '23503') {
                throw new InternalServerErrorException('La orden está bloqueada por el sistema contable y no puede ser eliminada.');
            }
            throw new InternalServerErrorException(`Error al eliminar la orden: ${errorDelete.message}`);
        }

        return { mensaje: 'Orden eliminada exitosamente' };
    }

    async registrarPago(id: string, nuevoPago: number) {
        const supabase = this.supabaseService.getClient();

        const { data: ordenActual, error: errorBusqueda } = await supabase
            .from('ordenes_pedido')
            .select('abono, saldo, subtotal')
            .eq('id', id)
            .single();

        if (errorBusqueda || !ordenActual) {
            throw new NotFoundException('Orden no encontrada para registrar pago.');
        }

        // Validar que no pague más de lo que debe
        if (nuevoPago > ordenActual.saldo) {
            throw new InternalServerErrorException(`El pago ($${nuevoPago}) supera el saldo pendiente ($${ordenActual.saldo}).`);
        }

        // Calcular el nuevo abono acumulado
        const abonoAcumulado = ordenActual.abono + nuevoPago;

        // Actualizar la orden en la base de datos
        const { data: ordenActualizada, error: errorUpdate } = await supabase
            .from('ordenes_pedido')
            .update({ abono: abonoAcumulado })
            .eq('id', id)
            .select()
            .single();

        if (errorUpdate) {
            throw new InternalServerErrorException('Error al actualizar el abono en la base de datos.');
        }

        return {
            mensaje: 'Pago registrado exitosamente',
            pago_recibido: nuevoPago,
            nuevo_abono_total: ordenActualizada.abono,
            nuevo_saldo_pendiente: ordenActualizada.saldo
        };
    }
}