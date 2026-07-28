import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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
  /** CNPJ (PJ) ou CPF (PF). Guardado só com dígitos. */
  @IsOptional() @IsString() taxId?: string;
  @IsOptional() @IsNumber() @Min(0) revenue?: number;

  @IsOptional() @IsString() ownerName?: string;
  @IsOptional() @IsEmail({}, { message: 'E-mail inválido' }) email?: string;
  @IsOptional() @IsString() phone?: string;

  @IsOptional() @IsString() zipCode?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() complement?: string;

  @IsOptional() @IsBoolean() acceptPix?: boolean;
  @IsOptional() @IsBoolean() acceptCard?: boolean;
}
