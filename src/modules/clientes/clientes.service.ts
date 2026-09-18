import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class ClientesService {
    constructor(private readonly supabaseService: SupabaseService) { }

    // Buscar cliente por cédula o RUC
    async buscarPorCedula(cedulaRuc: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
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
    async crearCliente(clienteData: {
        cedula_ruc: string;
        nombres: string;
        apellidos: string;
        telefono?: string;
        correo?: string;
        direccion?: string;
    }) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('clientes')
            .insert([clienteData])
            .select()
            .single();

        if (error) {
            console.error('Error detallado de Supabase:', error);
            // Manejar error si la cédula ya existe en la BD
            if (error.code === '23505') {
                throw new InternalServerErrorException('Ya existe un cliente registrado con esa cédula o RUC.');
            }
            throw new InternalServerErrorException('Error al registrar el cliente en la base de datos.');
        }

        return data;
    }
}