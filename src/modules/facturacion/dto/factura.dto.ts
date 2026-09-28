import { IsUUID, IsString, IsOptional, IsIn } from 'class-validator';

export class CreateFacturaDto {
    @IsUUID('4', { message: 'El ID de la orden debe ser un UUID válido.' })
    orden_id: string;

    @IsOptional()
    @IsString({ message: 'El método de pago debe ser un texto.' })
    @IsIn(['Efectivo', 'Transferencia', 'Tarjeta de Crédito', 'Tarjeta de Débito'], {
        message: 'El método de pago no es válido.'
    })
    metodo_pago?: string;
}