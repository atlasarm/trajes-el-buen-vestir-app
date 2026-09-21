import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';

@Injectable()
export class ClientesService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async obtenerTodos(page: number = 1, limit: number = 5, search: string = '') {
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        const supabase = this.supabaseService.getClient();

        let query = supabase
            .from('clientes')
            .select('*', { count: 'exact' });

        if (search) {
            query = query.or(`cedula_ruc.ilike.%${search}%,nombres.ilike.%${search}%,apellidos.ilike.%${search}%`);
        }

        const { data, count, error } = await query
            .order('nombres', { ascending: true })
            .range(from, to);

        if (error) throw new InternalServerErrorException(error.message);

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

    // Buscar cliente por cédula o RUC
    async buscarPorCedula(cedulaRuc: string) {
        const { data, error } = await this.supabaseService.getClient()
            .from('clientes')
            .select('*')
            .eq('cedula_ruc', cedulaRuc)
            .single();

        if (error || !data) {
            throw new NotFoundException(`Cliente con identificación ${cedulaRuc} no encontrado.`);
        }
        return data;
    }

    // Registrar un cliente nuevo
    async crearCliente(clienteData: CreateClienteDto) {
        const { data, error } = await this.supabaseService.getClient()
            .from('clientes')
            .insert([clienteData])
            .select()
            .single();

        if (error) {
            // Manejar error si la cédula ya existe en la BD
            if (error.code === '23505') {
                throw new InternalServerErrorException('Ya existe un cliente registrado con esa cédula o RUC.');
            }
            throw new InternalServerErrorException(`Fallo en Supabase: ${error.message} (Código: ${error.code})`);
        }
        return data;
    }

    async actualizar(id: string, clienteData: UpdateClienteDto) {
        const { data, error } = await this.supabaseService.getClient()
            .from('clientes')
            .update(clienteData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    async eliminar(id: string) {
        const { error } = await this.supabaseService.getClient()
            .from('clientes')
            .delete()
            .eq('id', id);

        if (error) throw new InternalServerErrorException(error.message);
        return { message: 'Cliente eliminado correctamente' };
    }
}