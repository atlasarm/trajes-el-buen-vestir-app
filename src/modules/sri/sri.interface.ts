export interface ItemFacturaSRI {
    codigoPrincipal: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
}

export interface ClienteSRI {
    razonSocial: string;
    identificacion: string;
    tipoIdentificacion: string;
    direccion: string;
}

export interface FacturaSRIDto {
    secuencial: string;
    cliente: ClienteSRI;
    items: ItemFacturaSRI[];
    subtotal: number;
}