import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsNumber,
  IsObject,
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

  // Wave 2/3 — endereço embutido + observações livres.
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() complement?: string;
  @IsOptional() @IsString() observations?: string;

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

  // Wave 2/3 — endereço embutido + observações livres.
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() complement?: string;
  @IsOptional() @IsString() observations?: string;

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

export class CreateCustomerNoteDto {
  @IsString() @MinLength(1) text: string;
}

// Registra um arquivo/imagem já enviado ao storage (via POST /uploads) na
// galeria do cliente. Recebe a URL pública + metadados de exibição.
export class CreateCustomerFileDto {
  @IsString() @MinLength(1) url: string;
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsNumber() size?: number;
}

export class CreateCustomerAnamnesisDto {
  @IsOptional() @IsString() templateId?: string;
  @IsOptional() @IsObject() answersJson?: Record<string, unknown>;
  @IsOptional() @IsISO8601() signedAt?: string;
}

export class UpdateCustomerAnamnesisDto {
  @IsOptional() @IsObject() answersJson?: Record<string, unknown>;
  // Aceita ISO-8601 p/ assinar, ou null p/ "des-assinar".
  @IsOptional() @IsISO8601() signedAt?: string | null;
}

// Resgate de cashback: insere linha NEGATIVA no ledger CustomerCashback.
export class RedeemCashbackDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsString() note?: string;
}

// Ajuste manual de cashback: crédito (positivo) ou débito (negativo) no ledger.
export class AdjustCashbackDto {
  @IsNumber() amount: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsISO8601() expiresAt?: string;
}
