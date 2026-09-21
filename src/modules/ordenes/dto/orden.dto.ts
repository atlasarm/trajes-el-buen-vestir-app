import { IsUUID, IsOptional, IsNumber, IsString, IsDateString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class DetalleOrdenDto {
    @IsString()
    tipo_item: string;

    @IsString()
    descripcion: string;

    @IsOptional()
    @IsString()
    imagen_referencia_url?: string;

    @IsNumber()
    @Min(1)
    cantidad: number;

    @IsNumber()
    @Min(0)
    precio_unitario: number;
}

export class CreateOrdenDto {
    @IsUUID()
    cliente_id: string;

    @IsOptional()
    @IsDateString()
    fecha_entrega_estimada?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    abono?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DetalleOrdenDto)
    detalles: DetalleOrdenDto[];
}