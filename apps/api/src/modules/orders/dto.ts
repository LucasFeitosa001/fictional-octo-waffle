import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() date?: string;
  /**
   * Agendamento de origem. Com ele a criação vira IDEMPOTENTE: se aquele
   * agendamento já tem comanda, o endpoint devolve a existente em vez de abrir
   * outra — era assim que "Acessar comanda" criava uma comanda por clique.
   * Ver estudo 52.
   */
  @IsOptional() @IsString() appointmentId?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddItemDto)
  items?: AddItemDto[];
}

export class UpdateOrderDto {
  @IsOptional() @IsIn(['open', 'finished', 'canceled']) status?: 'open' | 'finished' | 'canceled';
  @IsOptional() @IsString() notes?: string;
}

export class AddItemDto {
  @IsIn(['service', 'product']) kind: 'service' | 'product';
  @IsString() refId: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsNumber() @Min(0.001) quantity?: number;
  // Opcional: quando ausente/0, o backend resolve o preço pelo catálogo
  // (Service.price / Product.salePrice). Ver OrdersService.resolveUnitPrice.
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  // Teto do desconto NÃO cabe aqui: o bruto do item é `unitPrice × quantity` e o
  // unitPrice pode nem vir no corpo (o backend resolve pelo catálogo em
  // OrdersService.resolveUnitPrice). Quem recusa desconto maior que o item é o
  // service — ver OrdersService.assertDescontoDoItem, chamado no addItem, no
  // updateItem e no create. Sem essa trava, "200" no lugar de "20" num item de
  // R$ 100 zerava a comanda inteira e o Faturar passava sem pagamento nenhum.
  @IsOptional() @IsNumber() @Min(0) discount?: number;
}

/**
 * PATCH /orders/:id/items/:itemId — aba "Dados" (Salvar) do drawer + set de batchId
 * na aba "Lote" de itens de produto. Todos os campos são opcionais (partial update).
 */
export class UpdateOrderItemDto {
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsNumber() @Min(0.001) quantity?: number;
  // Idem AddItemDto.discount: o teto (não passar do bruto do item) é aplicado no
  // service, que é quem conhece unitPrice × quantity depois do partial update.
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  // Lote (aba "Lote"). Enviar null limpa o lote.
  @IsOptional() @IsString() batchId?: string | null;
}

/** Aba "Auxiliares" do item de serviço (rateio de comissão). Não altera o total. */
export class AddAuxiliaryDto {
  @IsString() professionalId: string;
  @IsIn(['establishment', 'professional']) discountFrom: 'establishment' | 'professional';
  @IsIn(['percent', 'value']) valueType: 'percent' | 'value';
  @IsNumber() @Min(0) value: number;
}

/**
 * Aba "Produtos consumidos" do item de serviço. Baixa estoque (InventoryMovement out)
 * mas NÃO soma no total da comanda.
 */
export class AddConsumedProductDto {
  @IsString() productId: string;
  @IsNumber() @Min(0.001) quantity: number;
  @IsOptional() @IsNumber() @Min(0) unitValue?: number;
  @IsOptional() @IsString() batchId?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) extraQuantity?: number;
}

export class AddDiscountDto {
  @IsIn(['percent', 'value']) type: 'percent' | 'value';
  @IsNumber() @Min(0) value: number;
  @IsOptional() @IsString() reason?: string;
}

export class AddPaymentDto {
  @IsOptional() @IsString() paymentMethodId?: string;
  @IsOptional() @IsString() accountId?: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() description?: string;
}

/** POST /orders/:id/credit e /orders/:id/cashback — usa saldo do cliente na comanda. */
export class UseBalanceDto {
  @IsNumber() @Min(0.01) amount: number;
}
