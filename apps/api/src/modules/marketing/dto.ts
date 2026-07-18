import {
  IsArray,
  IsBoolean,
  IsEnum,
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
