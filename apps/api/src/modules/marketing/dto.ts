import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// Reuses Prisma enums by their string literal values.
export type ScopeType = 'service' | 'product' | 'category' | 'all';
export type DiscountTypeDto = 'percent' | 'value';

export class UpdateBookingLinkDto {
  @IsOptional() @IsString() @MinLength(2) slug?: string;
  @IsOptional() @IsBoolean() active?: boolean;
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
