import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class OrdenesService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async crearOrden(ordenData: {
        cliente_id: string;
        fecha_entrega_estimada?: string;
        abono?: number;
        detalles: Array<{
            tipo_item: string;
            descripcion: string;
            cantidad: number;
            precio_unitario: number;
            imagen_referencia_url?: string;
        }>;
    }) {
        const supabase = this.supabaseService.getClient();
        const { cliente_id, fecha_entrega_estimada, abono = 0, detalles } = ordenData;

        // Calcular subtotal de la orden
        const subtotalCalculado = detalles.reduce(
            (suma, item) => suma + item.cantidad * item.precio_unitario,
            0,
        );

        // Insertar la Cabecera de la Orden
        const { data: orden, error: ordenError } = await supabase
            .from('ordenes_pedido')
            .insert([{
                cliente_id,
                fecha_entrega_estimada,
                subtotal: subtotalCalculado,
                abono
            }])
            .select()
            .single();

        if (ordenError) {
            console.error('Error al insertar cabecera de orden:', ordenError);
            throw new InternalServerErrorException('Error al registrar la orden principal.');
        }

        // Preparar e Insertar los Detalles
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
            console.error('Error al insertar detalles de orden:', detallesError);
            throw new InternalServerErrorException('Error al registrar los detalles de la orden.');
        }

        return {
            mensaje: 'Orden registrada exitosamente',
            orden_id: orden.id,
            subtotal: subtotalCalculado,
            abono_registrado: abono,
            saldo_pendiente: orden.saldo
        };
    }
}