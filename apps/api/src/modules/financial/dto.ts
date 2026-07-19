import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// Enums mirror the Prisma schema (packages/db/prisma/schema.prisma).
export enum TransactionKindDto {
  income = 'income',
  expense = 'expense',
}

export enum PaymentStatusDto {
  pending = 'pending',
  paid = 'paid',
  reversed = 'reversed',
}

export enum FinancialAccountTypeDto {
  cash = 'cash',
  bank = 'bank',
}

export enum FinancialCategoryKindDto {
  debit = 'debit',
  credit = 'credit',
}

export enum PartyTypeDto {
  customer = 'customer',
  professional = 'professional',
  supplier = 'supplier',
}

// ---- Transactions ----
export class ListTransactionsQueryDto {
  @IsOptional() @IsEnum(TransactionKindDto) type?: TransactionKindDto;
  @IsOptional() @IsEnum(PaymentStatusDto) status?: PaymentStatusDto;
  @IsOptional() @IsString() paymentMethodId?: string;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
  // 'true' inclui as transações estornadas na lista (padrão: ocultas).
  @IsOptional() @IsString() includeReversed?: string;
}

// Transferência entre contas (gera um par de lançamentos: saída na conta de
// origem + entrada na conta de destino). O schema não possui TransactionKind
// dedicado a transferência, por isso o par usa expense/income.
export class CreateTransferDto {
  @IsNumber() @Min(0) amount: number;
  @IsString() fromAccountId: string;
  @IsString() toAccountId: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() date?: string;
}

export class CreateTransactionDto {
  @IsEnum(TransactionKindDto) kind: TransactionKindDto;
  @IsNumber() @Min(0) grossAmount: number;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() paymentMethodId?: string;
  @IsOptional() @IsEnum(PartyTypeDto) partyType?: PartyTypeDto;
  @IsOptional() @IsString() partyId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() paidAt?: string;
  @IsOptional() @IsEnum(PaymentStatusDto) status?: PaymentStatusDto;
}

export class UpdateTransactionDto {
  @IsOptional() @IsEnum(TransactionKindDto) kind?: TransactionKindDto;
  @IsOptional() @IsNumber() @Min(0) grossAmount?: number;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() paymentMethodId?: string;
  @IsOptional() @IsEnum(PartyTypeDto) partyType?: PartyTypeDto;
  @IsOptional() @IsString() partyId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() paidAt?: string;
  @IsOptional() @IsEnum(PaymentStatusDto) status?: PaymentStatusDto;
}

// ---- Financial accounts ----
export class CreateFinancialAccountDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsEnum(FinancialAccountTypeDto) type?: FinancialAccountTypeDto;
  @IsOptional() @IsNumber() initialBalance?: number;
}

export class UpdateFinancialAccountDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsEnum(FinancialAccountTypeDto) type?: FinancialAccountTypeDto;
  @IsOptional() @IsNumber() initialBalance?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

// ---- Payment methods ----
export class CreatePaymentMethodDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsNumber() @Min(0) feePercent?: number;
  @IsOptional() @IsInt() @Min(0) settlementDays?: number;
  @IsOptional() @IsString() defaultAccountId?: string;
  @IsOptional() @IsBoolean() goesToCash?: boolean;
}

export class UpdatePaymentMethodDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsNumber() @Min(0) feePercent?: number;
  @IsOptional() @IsInt() @Min(0) settlementDays?: number;
  @IsOptional() @IsString() defaultAccountId?: string;
  @IsOptional() @IsBoolean() goesToCash?: boolean;
}

// ---- Financial categories ----
export class CreateFinancialCategoryDto {
  @IsString() @MinLength(2) name: string;
  @IsEnum(FinancialCategoryKindDto) kind: FinancialCategoryKindDto;
  @IsOptional() @IsBoolean() countsAsCommission?: boolean;
  @IsOptional() @IsBoolean() isExpense?: boolean;
}

export class UpdateFinancialCategoryDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsEnum(FinancialCategoryKindDto) kind?: FinancialCategoryKindDto;
  @IsOptional() @IsBoolean() countsAsCommission?: boolean;
  @IsOptional() @IsBoolean() isExpense?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

// ---- Summary ----
export class SummaryQueryDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}
