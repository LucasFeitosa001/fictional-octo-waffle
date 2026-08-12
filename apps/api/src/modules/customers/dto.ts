import { Transform, Type } from 'class-transformer';
import {
  normalizarCep,
  normalizarCnpj,
  normalizarCpf,
  normalizarTelefone,
} from './dto-helpers';
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
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// Trim + normalização/validação REAL no boundary — o "5555555" (5 na tela do
// PhoneField, gravado como "555…5" por causa do DDI grudado) chegava aqui e o
// service gravava. Agora `normalizarTelefone` devolve só dígitos, exige >= 10
// e lança 400 para o resto. Ver estudo 125.
const normPhone = ({ value }: { value: unknown }) => normalizarTelefone(value);
const normCpf = ({ value }: { value: unknown }) => normalizarCpf(value);
const normCnpj = ({ value }: { value: unknown }) => normalizarCnpj(value);
const normCep = ({ value }: { value: unknown }) => normalizarCep(value);

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
  @IsOptional() @Transform(normPhone) @IsString() @MaxLength(15) phone?: string;
  @IsOptional() @Transform(normPhone) @IsString() @MaxLength(15) secondaryPhone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsISO8601() birthday?: string;
  @IsOptional() @Transform(normCpf) @IsString() @MaxLength(11) cpf?: string;
  @IsOptional() @Transform(normCnpj) @IsString() @MaxLength(14) cnpj?: string;
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
  @IsOptional() @Transform(normCep) @IsString() @MaxLength(8) cep?: string;
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

/**
 * PATCH parcial com TRÊS estados por campo (estudo 141):
 *   - chave ausente → não mexa;
 *   - `null`        → APAGUE;
 *   - valor         → grave.
 *
 * Os campos apagáveis aceitam `string | null`. `@IsOptional()` do class-validator
 * ignora os validadores quando o valor é `null`, então `@IsString`/`@IsEmail`
 * continuam valendo para texto e deixam o `null` passar; os `@Transform` daqui
 * preservam o `null` (ver dto-helpers). Sem isso não havia como tirar do cadastro
 * um telefone que é de OUTRA pessoa — a tela dizia "Cliente salvo" e o número
 * antigo voltava.
 */
export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() nickname?: string | null;
  @IsOptional() @Transform(normPhone) @IsString() @MaxLength(15) phone?: string | null;
  @IsOptional() @Transform(normPhone) @IsString() @MaxLength(15) secondaryPhone?: string | null;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsISO8601() birthday?: string | null;
  @IsOptional() @Transform(normCpf) @IsString() @MaxLength(11) cpf?: string | null;
  @IsOptional() @Transform(normCnpj) @IsString() @MaxLength(14) cnpj?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;

  // Cliente — profundidade (P0)
  @IsOptional() @IsString() rg?: string | null;
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
  @IsOptional() @Transform(normCep) @IsString() @MaxLength(8) cep?: string | null;
  @IsOptional() @IsString() street?: string | null;
  @IsOptional() @IsString() number?: string | null;
  @IsOptional() @IsString() district?: string | null;
  @IsOptional() @IsString() city?: string | null;
  @IsOptional() @IsString() state?: string | null;
  @IsOptional() @IsString() complement?: string | null;
  @IsOptional() @IsString() observations?: string | null;

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
