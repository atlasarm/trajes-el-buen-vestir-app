import { IsString, Matches, IsOptional, IsEmail } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateClienteDto {
    @IsString()
    @Matches(/^(\d{10}|\d{13})$/, {
        message: 'La identificación debe ser una cédula de 10 dígitos o un RUC de 13 dígitos numéricos exactos.',
    })
    cedula_ruc: string;

    @IsString()
    nombres: string;

    @IsString()
    apellidos: string;

    @IsOptional()
    @IsString()
    telefono?: string;

    @IsOptional()
    @IsEmail()
    correo?: string;

    @IsOptional()
    @IsString()
    direccion?: string;
}

export class UpdateClienteDto extends PartialType(CreateClienteDto) {}