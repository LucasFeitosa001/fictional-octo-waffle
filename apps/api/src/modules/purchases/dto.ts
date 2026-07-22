import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseItemDto {
  @IsString() productId: string;
  @IsNumber() @Min(0.001) quantity: number;
  @IsNumber() @Min(0) unitCost: number;
  /**
   * Desconto por item (Onda 7: PurchaseItem.discount). Entra no cálculo do
   * total da linha (PurchaseItem.total) e é persistido.
   */
  @IsOptional() @IsNumber() @Min(0) discount?: number;
}

export class CreatePurchaseDto {
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsDateString() date?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  /** Frete e desconto geral (Onda 7: Purchase.freight/discount) — persistidos. */
  @IsOptional() @IsNumber() @Min(0) freight?: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;

  /** Conta financeira de pagamento (Purchase.accountId). */
  @IsOptional() @IsString() accountId?: string;
  /** Forma de pagamento (Purchase.paymentMethodId). */
  @IsOptional() @IsString() paymentMethodId?: string;

  /** Observações (Onda 7: Purchase.notes) — persistidas. */
  @IsOptional() @IsString() notes?: string;

  /** Wave 2/3: número da nota fiscal + outras despesas/receitas. */
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsOptional() @IsNumber() @Min(0) otherExpenses?: number;
  @IsOptional() @IsNumber() @Min(0) otherIncome?: number;
}

export class UpdatePurchaseDto {
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsDateString() date?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items?: PurchaseItemDto[];

  @IsOptional() @IsNumber() @Min(0) freight?: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() paymentMethodId?: string;
  @IsOptional() @IsString() notes?: string;

  /** Wave 2/3: número da nota fiscal + outras despesas/receitas. */
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsOptional() @IsNumber() @Min(0) otherExpenses?: number;
  @IsOptional() @IsNumber() @Min(0) otherIncome?: number;
}
