import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CommissionScopeTypeDto {
  service = 'service',
  product = 'product',
  category = 'category',
  all = 'all',
}

export enum AmountTypeDto {
  percent = 'percent',
  fixed = 'fixed',
}

/**
 * settingsJson shape (mirrors schema comment: quem paga taxa/desconto, custo,
 * competência×disponibilidade, todas×finalizadas).
 * "paidBy": proportional = rateado; company = estabelecimento 100%;
 * professional = profissional 100%.
 */
export type CommissionPayer = 'proportional' | 'company' | 'professional';

export class CommissionRuleSettingsDto {
  @IsOptional() @IsString() cardFeePaidBy?: CommissionPayer;
  @IsOptional() @IsString() discountPaidBy?: CommissionPayer;
  @IsOptional() @IsString() additionalCostPaidBy?: CommissionPayer;
  @IsOptional() @IsString() basis?: 'competence' | 'availability';
  @IsOptional() @IsString() consider?: 'all' | 'finished';
  /** produtos consumidos: descontar da comissão ou ignorar */
  @IsOptional() @IsString() consumedProducts?: 'deduct' | 'ignore';
  /** texto padrão de recibo de comissão */
  @IsOptional() @IsString() receiptText?: string;
}

export class CreateCommissionRuleDto {
  @IsEnum(CommissionScopeTypeDto) scopeType: CommissionScopeTypeDto;
  @IsOptional() @IsString() scopeId?: string;
  @IsEnum(AmountTypeDto) type: AmountTypeDto;
  @IsNumber() @Min(0) value: number;
  @IsOptional() @IsObject() settingsJson?: Record<string, unknown>;
}

export class UpdateCommissionRuleDto {
  @IsOptional() @IsEnum(CommissionScopeTypeDto) scopeType?: CommissionScopeTypeDto;
  @IsOptional() @IsString() scopeId?: string;
  @IsOptional() @IsEnum(AmountTypeDto) type?: AmountTypeDto;
  @IsOptional() @IsNumber() @Min(0) value?: number;
  @IsOptional() @IsObject() settingsJson?: Record<string, unknown>;
}

export class UpdateCommissionEntryDto {
  @IsOptional() @IsString() status?: 'open' | 'paid' | 'reversed';
  @IsOptional() @IsBoolean() signed?: boolean;
}

export class CreateCommissionPaymentDto {
  @IsString() professionalId: string;
  /**
   * Entries a quitar. Se omitido/vazio, o service pega TODAS as entries `open`
   * do profissional (respeitando o filtro de período/closing).
   */
  @IsOptional() @IsArray() @IsString({ each: true }) entryIds?: string[];
  /**
   * Vales a descontar. Se omitido/vazio, o service desconta TODOS os vales
   * `open` do profissional.
   */
  @IsOptional() @IsArray() @IsString({ each: true }) advanceIds?: string[];
  @IsOptional() @IsString() closingId?: string;
  @IsOptional() @IsString() note?: string;
}

/** Um item do pagamento em lote (um por profissional). */
export class BulkPaymentItemDto {
  @IsString() professionalId: string;
  @IsOptional() @IsArray() @IsString({ each: true }) entryIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) advanceIds?: string[];
  @IsOptional() @IsString() note?: string;
}

export class BulkCommissionPaymentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkPaymentItemDto)
  items: BulkPaymentItemDto[];

  @IsOptional() @IsString() closingId?: string;
}

// ---- Vales (adiantamentos) ----
export class CreateCommissionAdvanceDto {
  @IsString() professionalId: string;
  @IsNumber() @Min(0) amount: number;
  /** ISO date; default = agora */
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() note?: string;
}

// ---- Exclusão (estorno) de pagamento ----
export class DeleteCommissionPaymentDto {
  @IsString() @IsNotEmpty() justification: string;
}
