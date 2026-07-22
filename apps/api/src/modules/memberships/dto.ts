import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MembershipServiceDto {
  @IsString() serviceId: string;
  @IsOptional() @IsInt() @Min(1) quantityPerCycle?: number;
  // Wave 4: grid de itens editável — preço/desconto/quantidade por item.
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsNumber() @Min(0) quantity?: number;
}

export class CreateMembershipPlanDto {
  @IsString() @MinLength(2) name: string;
  @IsNumber() @Min(0) recurringPrice: number;
  @IsOptional() @IsInt() @Min(1) intervalMonths?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => MembershipServiceDto)
  services: MembershipServiceDto[];
}

export class UpdateMembershipPlanDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsNumber() @Min(0) recurringPrice?: number;
  @IsOptional() @IsInt() @Min(1) intervalMonths?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MembershipServiceDto)
  services?: MembershipServiceDto[];
}

export class CreateCustomerMembershipDto {
  @IsString() customerId: string;
  @IsString() membershipPlanId: string;
}

export class UpdateCustomerMembershipDto {
  /** cancel / renew → status transition */
  @IsOptional() @IsString() status?: 'active' | 'canceled' | 'overdue';
  /** ISO date; set on renew */
  @IsOptional() @IsString() nextDueDate?: string;
}
