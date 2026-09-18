import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
    private readonly supabase: SupabaseClient;

    constructor(private configService: ConfigService) {
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
        const supabaseKey = this.configService.get<string>('SUPABASE_KEY');

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Faltan las credenciales de Supabase en el archivo .env');
        }

        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // Método que usaremos en el resto del proyecto para consultar la BD
    getClient(): SupabaseClient {
        return this.supabase;
    }
}