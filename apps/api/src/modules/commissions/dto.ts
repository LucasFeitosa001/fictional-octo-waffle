import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
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
  /** preço-base usado no desconto do produto consumido */
  @IsOptional() @IsString() consumedPriceBy?: 'none' | 'cost' | 'price' | 'professional';
  /** exibe a base bruta nos relatórios de comissão */
  @IsOptional() @IsBoolean() showGrossValue?: boolean;
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
  /**
   * Bonificação do lançamento. `bonusAmount` já existia no modelo e era somado
   * em toda a tela, mas NADA o escrevia — a coluna "Bonificações" era zero por
   * construção. Este campo é o que faltava para ela existir de verdade.
   */
  @IsOptional() @IsNumber() @Min(0) bonusAmount?: number;
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
  /**
   * COMO e DE ONDE o dinheiro saiu — os dois campos que o Belasis marca como
   * obrigatórios no drawer de pagamento. Sem eles não dá para gerar a despesa
   * no Financeiro, e o pagamento fica invisível para o fechamento do mês.
   * Opcionais no DTO por compatibilidade com integrações já existentes.
   */
  @IsOptional() @IsString() paymentMethodId?: string;
  @IsOptional() @IsString() accountId?: string;
  /** Data do pagamento (default = agora). */
  @IsOptional() @IsDateString() paidAt?: string;
  /** Trilho: 'manual' (padrão) ou 'salonpay'. */
  @IsOptional() @IsIn(['manual', 'salonpay']) rail?: 'manual' | 'salonpay';
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
  // Liquidação do LOTE inteiro: no Belasis o drawer pede uma forma, uma conta e
  // uma data para todos os selecionados de uma vez.
  @IsOptional() @IsString() paymentMethodId?: string;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsIn(['manual', 'salonpay']) rail?: 'manual' | 'salonpay';
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
