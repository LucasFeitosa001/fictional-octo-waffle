import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  normalizarCep,
  normalizarDocumento,
  normalizarTelefone,
} from '../customers/dto-helpers';

// Mesma normalização de estudo 125. Ver estudo 133.
const normPhone = ({ value }: { value: unknown }) => normalizarTelefone(value);
const normDoc = ({ value }: { value: unknown }) => normalizarDocumento(value);
const normCep = ({ value }: { value: unknown }) => normalizarCep(value);

export class CreateProfessionalDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @Transform(normPhone) @IsString() @MaxLength(15) phone?: string;
  @IsOptional() @IsString() profession?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsISO8601() birthday?: string;
  @IsOptional() @IsBoolean() onlineBookable?: boolean;
  @IsOptional() @IsBoolean() notifyWhatsapp?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  // Dados cadastrais adicionais (Onda 7).
  @IsOptional() @Transform(normDoc) @IsString() @MaxLength(14) document?: string;
  @IsOptional() @IsString() rg?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsBoolean() receivesCommission?: boolean;
  @IsOptional() @IsBoolean() generateSchedule?: boolean;
  // Endereço embutido (Onda 7).
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() complement?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @Transform(normCep) @IsString() @MaxLength(8) zip?: string;
}

export class UpdateProfessionalDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @Transform(normPhone) @IsString() @MaxLength(15) phone?: string;
  @IsOptional() @IsString() profession?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsISO8601() birthday?: string;
  @IsOptional() @IsBoolean() onlineBookable?: boolean;
  @IsOptional() @IsBoolean() notifyWhatsapp?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  // Dados cadastrais adicionais (Onda 7).
  @IsOptional() @Transform(normDoc) @IsString() @MaxLength(14) document?: string;
  @IsOptional() @IsString() rg?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsBoolean() receivesCommission?: boolean;
  @IsOptional() @IsBoolean() generateSchedule?: boolean;
  // Endereço embutido (Onda 7).
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() complement?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @Transform(normCep) @IsString() @MaxLength(8) zip?: string;
}

export class ScheduleDto {
  @IsInt() @Min(0) @Max(6) weekday: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime: string;
}

export class SetServicesDto {
  @IsString({ each: true }) serviceIds: string[];
}

export class CommissionRuleDto {
  @IsString() scopeType: 'service' | 'product' | 'category' | 'all';
  @IsOptional() @IsString() scopeId?: string;
  @IsIn(['percent', 'fixed']) type: 'percent' | 'fixed';
  // Percent: 0..100. Fixed: >= 0. O DTO não sabe o tipo antes do validate, então
  // exige `>= 0` aqui e o service completa a checagem `<= 100` para percent.
  @IsNumber() @Min(0) value: number;
}
