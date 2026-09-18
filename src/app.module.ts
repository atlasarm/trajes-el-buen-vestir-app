import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './config/supabase.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { OrdenesModule } from './modules/ordenes/ordenes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    SupabaseModule,
    ClientesModule,
    OrdenesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}