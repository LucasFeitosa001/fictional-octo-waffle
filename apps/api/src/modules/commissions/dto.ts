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
 */
export class CommissionRuleSettingsDto {
  @IsOptional() @IsString() cardFeePaidBy?: 'company' | 'professional';
  @IsOptional() @IsString() discountPaidBy?: 'company' | 'professional';
  @IsOptional() @IsString() additionalCostPaidBy?: 'company' | 'professional';
  @IsOptional() @IsString() basis?: 'competence' | 'availability';
  @IsOptional() @IsString() consider?: 'all' | 'finished';
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
