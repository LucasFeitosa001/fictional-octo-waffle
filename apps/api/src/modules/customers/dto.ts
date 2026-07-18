import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CustomerDependentDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsString() relationship?: string;
}

export class CustomerSocialProfileDto {
  @IsString() @MinLength(1) platform: string;
  @IsString() @MinLength(1) url: string;
}

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() secondaryPhone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsISO8601() birthday?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsBoolean() active?: boolean;

  // Cliente — profundidade (P0)
  @IsOptional() @IsString() rg?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() referredById?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) defaultDiscountPercent?: number;
  @IsOptional() @IsBoolean() notificationsEnabled?: boolean;
  @IsOptional() @IsBoolean() whatsappOptIn?: boolean;
  @IsOptional() @IsBoolean() smsOptIn?: boolean;
  @IsOptional() @IsBoolean() onlineAccessBlocked?: boolean;
  @IsOptional() @IsString() legacyId?: string;
  @IsOptional() @IsString() legacySource?: string;

  // Coleções aninhadas opcionais
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerDependentDto)
  dependents?: CustomerDependentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerSocialProfileDto)
  socialProfiles?: CustomerSocialProfileDto[];
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() secondaryPhone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsISO8601() birthday?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsBoolean() active?: boolean;

  // Cliente — profundidade (P0)
  @IsOptional() @IsString() rg?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() referredById?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) defaultDiscountPercent?: number;
  @IsOptional() @IsBoolean() notificationsEnabled?: boolean;
  @IsOptional() @IsBoolean() whatsappOptIn?: boolean;
  @IsOptional() @IsBoolean() smsOptIn?: boolean;
  @IsOptional() @IsBoolean() onlineAccessBlocked?: boolean;
  @IsOptional() @IsString() legacyId?: string;
  @IsOptional() @IsString() legacySource?: string;

  // Coleções aninhadas opcionais
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerDependentDto)
  dependents?: CustomerDependentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerSocialProfileDto)
  socialProfiles?: CustomerSocialProfileDto[];
}

export class CreateCustomerDebtDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
}

export class CreateCustomerDebtPaymentDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsString() method?: string;
}
