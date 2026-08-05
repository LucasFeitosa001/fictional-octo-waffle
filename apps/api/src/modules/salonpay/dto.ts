import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  normalizarCep,
  normalizarDocumento,
  normalizarTelefone,
} from '../customers/dto-helpers';

// Validação no boundary — mesmo padrão do estudo 125. Antes o SalonPay aceitava
// `taxId="123"`, `phone="tel"`; agora `taxId` (CPF ou CNPJ com DV), `phone`
// (>= 10 dígitos) e `zipCode` (8 dígitos) chegam limpos, ou 400.
const normDoc = ({ value }: { value: unknown }) => normalizarDocumento(value);
const normPhone = ({ value }: { value: unknown }) => normalizarTelefone(value);
const normCep = ({ value }: { value: unknown }) => normalizarCep(value);

/**
 * Cadastro de recebimento do SalonPay — os mesmos campos do formulário da
 * referência ("Informe alguns dados para começar a receber os pagamentos
 * online").
 *
 * Tudo opcional no DTO de propósito: o salão salva em etapas, e travar o
 * rascunho por campo faltando faria a pessoa perder o que já digitou. Quem
 * decide se o cadastro está completo é `SalonPayService.isComplete`, que é o
 * que o botão de pagar consulta.
 */
export class UpsertSalonPayAccountDto {
  @IsOptional() @IsIn(['individual', 'company']) personType?: 'individual' | 'company';

  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() companyType?: string;
  /** CNPJ (PJ) ou CPF (PF). Guardado só com dígitos, DV validado. */
  @IsOptional() @Transform(normDoc) @IsString() @MaxLength(14) taxId?: string;
  @IsOptional() @IsNumber() @Min(0) revenue?: number;

  @IsOptional() @IsString() ownerName?: string;
  @IsOptional() @IsEmail({}, { message: 'E-mail inválido' }) email?: string;
  @IsOptional() @Transform(normPhone) @IsString() @MaxLength(15) phone?: string;

  @IsOptional() @Transform(normCep) @IsString() @MaxLength(8) zipCode?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() complement?: string;

  @IsOptional() @IsBoolean() acceptPix?: boolean;
  @IsOptional() @IsBoolean() acceptCard?: boolean;
}
