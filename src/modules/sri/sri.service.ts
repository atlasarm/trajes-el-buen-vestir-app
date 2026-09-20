import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Builder } from 'xml2js';
import axios from 'axios';
import { FirmaHelper } from './firma.helper';
import { FacturaSRIDto } from './sri.interface';

@Injectable()
export class SriService {
    constructor(private configService: ConfigService) { }

    private calcularDigitoVerificador(clave48: string): string {
        let suma = 0;
        let factor = 2;
        for (let i = clave48.length - 1; i >= 0; i--) {
            suma += parseInt(clave48.charAt(i), 10) * factor;
            factor = factor === 7 ? 2 : factor + 1;
        }
        const modulo = suma % 11;
        const digito = 11 - modulo;
        if (digito === 11) return '0';
        if (digito === 10) return '1';
        return digito.toString();
    }

    private async transmitirAlSRI(xmlFirmado: string) {
        const ambiente = this.configService.get('SRI_ENVIRONMENT');
        const urlRecepcion = ambiente === 'pruebas'
            ? 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl'
            : 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';

        const xmlBase64 = Buffer.from(xmlFirmado).toString('base64');
        const soapEnvelope = `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
                <soapenv:Header/>
                <soapenv:Body><ec:validarComprobante><xml>${xmlBase64}</xml></ec:validarComprobante></soapenv:Body>
            </soapenv:Envelope>`;

        try {
            const respuesta = await axios.post(urlRecepcion, soapEnvelope, { headers: { 'Content-Type': 'text/xml;charset=UTF-8' } });
            return respuesta.data;
        } catch (error: any) {
            throw new InternalServerErrorException('Fallo al comunicar con Recepción SRI.');
        }
    }

    private async solicitarAutorizacionSRI(claveAcceso: string) {
        const ambiente = this.configService.get('SRI_ENVIRONMENT');
        const urlAutorizacion = ambiente === 'pruebas'
            ? 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl'
            : 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';

        const soapEnvelope = `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
                <soapenv:Header/>
                <soapenv:Body><ec:autorizacionComprobante><claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante></ec:autorizacionComprobante></soapenv:Body>
            </soapenv:Envelope>`;

        try {
            const respuesta = await axios.post(urlAutorizacion, soapEnvelope, { headers: { 'Content-Type': 'text/xml;charset=UTF-8' } });
            return respuesta.data;
        } catch (error: any) {
            throw new InternalServerErrorException('Fallo al solicitar Autorización SRI.');
        }
    }

    public async procesarFacturaElectronica(datos: FacturaSRIDto) {
        const rucEmisor = '1753329182001';
        const ambienteSRI = this.configService.get('SRI_ENVIRONMENT') === 'pruebas' ? '1' : '2';
        const tipoEmision = '1';
        const tipoComprobante = '01';
        const estab = '001';
        const ptoEmi = '001';
        const codigoNumerico = '12345678';

        const fechaActual = new Date();
        const dia = fechaActual.getDate().toString().padStart(2, '0');
        const mes = (fechaActual.getMonth() + 1).toString().padStart(2, '0');
        const anio = fechaActual.getFullYear().toString();

        const clave48 = `${dia}${mes}${anio}${tipoComprobante}${rucEmisor}${ambienteSRI}${estab}${ptoEmi}${datos.secuencial}${codigoNumerico}${tipoEmision}`;
        const claveAccesoOficial = `${clave48}${this.calcularDigitoVerificador(clave48)}`;

        const facturaJson = {
            factura: {
                $: { id: 'comprobante', version: '1.1.0' },
                infoTributaria: {
                    ambiente: ambienteSRI,
                    tipoEmision,
                    razonSocial: 'SARMIENTO CAILLAGUA NESTOR DAVID',
                    nombreComercial: 'Trajes El Buen Vestir',
                    ruc: rucEmisor,
                    claveAcceso: claveAccesoOficial,
                    codDoc: tipoComprobante,
                    estab,
                    ptoEmi,
                    secuencial: datos.secuencial,
                    dirMatriz: 'Quito, Ecuador',
                },
                infoFactura: {
                    fechaEmision: `${dia}/${mes}/${anio}`,
                    dirEstablecimiento: 'Quito, Ecuador',
                    obligadoContabilidad: 'NO',
                    tipoIdentificacionComprador: datos.cliente.tipoIdentificacion,
                    razonSocialComprador: datos.cliente.razonSocial,
                    identificacionComprador: datos.cliente.identificacion,
                    totalSinImpuestos: datos.subtotal.toFixed(2),
                    totalDescuento: '0.00',
                    totalConImpuestos: {
                        totalImpuesto: [{ codigo: '2', codigoPorcentaje: '0', baseImponible: datos.subtotal.toFixed(2), valor: '0.00' }]
                    },
                    propina: '0.00',
                    importeTotal: datos.subtotal.toFixed(2),
                    moneda: 'DOLAR'
                },
                detalles: {
                    detalle: datos.items.map(item => ({
                        codigoPrincipal: item.codigoPrincipal,
                        descripcion: item.descripcion,
                        cantidad: item.cantidad.toFixed(2),
                        precioUnitario: item.precioUnitario.toFixed(2),
                        descuento: item.descuento.toFixed(2),
                        precioTotalSinImpuesto: (item.cantidad * item.precioUnitario - item.descuento).toFixed(2),
                        impuestos: {
                            impuesto: [{ codigo: '2', codigoPorcentaje: '0', tarifa: '0.00', baseImponible: (item.cantidad * item.precioUnitario - item.descuento).toFixed(2), valor: '0.00' }]
                        }
                    }))
                }
            }
        };

        const builder = new Builder({ xmldec: { version: '1.0', encoding: 'UTF-8' } });
        const xmlCrudo = builder.buildObject(facturaJson);
        const passwordFirma = this.configService.get<string>('SRI_CERT_PASSWORD');
        const xmlFirmadoFinal = await FirmaHelper.firmarXML(xmlCrudo, passwordFirma!);

        await this.transmitirAlSRI(xmlFirmadoFinal);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const respuestaAutorizacion = await this.solicitarAutorizacionSRI(claveAccesoOficial);
        const autorizada = respuestaAutorizacion.includes('<estado>AUTORIZADO</estado>');

        return {
            exito: autorizada,
            claveAcceso: claveAccesoOficial,
            xmlAutorizado: respuestaAutorizacion
        };
    }
}