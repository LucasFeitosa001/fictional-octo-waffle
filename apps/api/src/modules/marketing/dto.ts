import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Reuses Prisma enums by their string literal values.
export type ScopeType = 'service' | 'product' | 'category' | 'all';
export type DiscountTypeDto = 'percent' | 'value';

export class UpdateBookingLinkDto {
  @IsOptional() @IsString() @MinLength(2) slug?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

// One row of the salon's weekly opening hours, persisted on
// Company.businessHoursJson. `start`/`end` are wall-clock "HH:MM" strings in the
// salon timezone; ignored when the day is closed.
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BusinessHoursDayDto {
  @IsInt() @Min(0) @Max(6) weekday: number;
  @IsBoolean() open: boolean;
  @IsString() @Matches(HHMM, { message: 'start deve estar no formato HH:MM' }) start: string;
  @IsString() @Matches(HHMM, { message: 'end deve estar no formato HH:MM' }) end: string;
}

export class UpdateBusinessHoursDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessHoursDayDto)
  days: BusinessHoursDayDto[];
}

export class CreatePromotionDto {
  @IsString() @MinLength(2) name: string;
  @IsEnum(['service', 'product', 'category', 'all']) scopeType: ScopeType;
  @IsOptional() @IsString() scopeId?: string;
  @IsEnum(['percent', 'value']) discountType: DiscountTypeDto;
  @IsNumber() @Min(0) discountValue: number;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validTo?: string;
  @IsOptional() @IsInt() @Min(0) usageLimit?: number;
  @IsOptional() @IsBoolean() appliesOnline?: boolean;
}

export class UpdatePromotionDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsEnum(['service', 'product', 'category', 'all']) scopeType?: ScopeType;
  @IsOptional() @IsString() scopeId?: string;
  @IsOptional() @IsEnum(['percent', 'value']) discountType?: DiscountTypeDto;
  @IsOptional() @IsNumber() @Min(0) discountValue?: number;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validTo?: string;
  @IsOptional() @IsInt() @Min(0) usageLimit?: number;
  @IsOptional() @IsBoolean() appliesOnline?: boolean;
}

// ---- perfil público do salão (SalonWebProfile, onda 7) ----
export type ThemePreferenceDto = 'light' | 'dark' | 'auto';
export type SchedulingFlowDto = 'service' | 'professional';

// Cor de destaque (marca) do agendamento online: "#RRGGBB" ou string vazia
// (limpa a cor → volta ao padrão da casa).
const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;

export class UpdateWebProfileDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() facebook?: string;
  @IsOptional() @IsString() instagram?: string;
  @IsOptional() @IsBoolean() wifi?: boolean;
  @IsOptional() @IsBoolean() snackBar?: boolean;
  @IsOptional() @IsBoolean() parkingLot?: boolean;
  @IsOptional() @IsBoolean() kids?: boolean;
  @IsOptional() @IsBoolean() accessibility?: boolean;
  @IsOptional() @IsIn(['light', 'dark', 'auto']) themePreference?: ThemePreferenceDto;
  @IsOptional() @IsIn(['service', 'professional']) schedulingFlow?: SchedulingFlowDto;
  @IsOptional() @IsBoolean() requiredLogin?: boolean;
  @IsOptional()
  @IsString()
  @Matches(/^(#([0-9a-fA-F]{6}))?$/, {
    message: 'accentColor deve ser um hex "#RRGGBB" ou vazio',
  })
  accentColor?: string;
}

export { HEX_COLOR };

// ---- aparência do agendamento online (Setting key `booking.appearance`) ----
// Cada cor é um hex "#RRGGBB" ou string vazia (limpa → volta ao default do
// web-club). `hideNavbar` esconde a barra preta do topo da página pública.
const HEX_OR_EMPTY = /^(#([0-9a-fA-F]{6}))?$/;

export class UpdateBookingAppearanceDto {
  @IsOptional() @IsBoolean() hideNavbar?: boolean;
  @IsOptional()
  @IsString()
  @Matches(HEX_OR_EMPTY, { message: 'primaryColor deve ser um hex "#RRGGBB" ou vazio' })
  primaryColor?: string;
  @IsOptional()
  @IsString()
  @Matches(HEX_OR_EMPTY, { message: 'accentColor deve ser um hex "#RRGGBB" ou vazio' })
  accentColor?: string;
  @IsOptional()
  @IsString()
  @Matches(HEX_OR_EMPTY, { message: 'backgroundColor deve ser um hex "#RRGGBB" ou vazio' })
  backgroundColor?: string;
}

// ---- galeria de fotos do perfil público (GalleryPhoto, onda 7) ----
export class CreateGalleryPhotoDto {
  @IsString() @MinLength(1) url: string;
  @IsOptional() @IsString() caption?: string;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

export class UpdateReviewSettingsDto {
  @IsOptional() @IsBoolean() moduleActive?: boolean;
  @IsOptional() @IsString() headerTitle?: string;
  @IsOptional() @IsString() headerText?: string;
  @IsOptional() @IsString() successText?: string;
  @IsOptional() @IsString() footerText?: string;
  @IsOptional() @IsString() requestMessage?: string;
}

export class CreateCashbackRuleDto {
  @IsEnum(['service', 'product', 'category', 'all']) scopeType: ScopeType;
  @IsOptional() @IsString() scopeId?: string;
  @IsNumber() @Min(0) percent: number;
  @IsOptional() @IsInt() @Min(0) validityDays?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateCashbackRuleDto {
  @IsOptional() @IsEnum(['service', 'product', 'category', 'all']) scopeType?: ScopeType;
  @IsOptional() @IsString() scopeId?: string;
  @IsOptional() @IsNumber() @Min(0) percent?: number;
  @IsOptional() @IsInt() @Min(0) validityDays?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

// Programa global de cashback da empresa (Company.cashback*).
export class UpdateCashbackConfigDto {
  @IsOptional() @IsBoolean() cashbackActive?: boolean;
  @IsOptional() @IsEnum(['percent', 'value']) cashbackValueType?: 'percent' | 'value';
  @IsOptional() @IsNumber() @Min(0) cashbackValue?: number;
  @IsOptional() @IsBoolean() cashbackCanRedeem?: boolean;
  @IsOptional() @IsNumber() @Min(0) cashbackMinimum?: number;
}
