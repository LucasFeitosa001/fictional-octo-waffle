import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsString() notes?: string;
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
  @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
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
