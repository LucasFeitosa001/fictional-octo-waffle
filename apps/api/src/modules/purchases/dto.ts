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
   * Desconto por item. O schema (PurchaseItem) NÃO tem coluna de desconto,
   * então o valor é usado apenas no cálculo do total e NÃO é persistido.
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

  /** Frete e desconto geral entram no cálculo do total (não têm coluna própria). */
  @IsOptional() @IsNumber() @Min(0) freight?: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;

  /** Conta financeira de pagamento (Purchase.accountId). */
  @IsOptional() @IsString() accountId?: string;
  /** Forma de pagamento (Purchase.paymentMethodId). */
  @IsOptional() @IsString() paymentMethodId?: string;

  /** Sem coluna no schema — aceito para paridade, não persistido. */
  @IsOptional() @IsString() notes?: string;
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
}
