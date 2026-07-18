import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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
  @IsNumber() @Min(0) amount: number;
  /** entries to mark as paid in the same operation */
  @IsOptional() entryIds?: string[];
  @IsOptional() @IsString() closingId?: string;
}
