import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsNumber() @Min(0) price: number;
  // Wave 2/3: tipo de preço (fixo|a_partir_de) e tipo de custo adicional (percent|value).
  @IsOptional() @IsString() priceType?: string;
  @IsOptional() @IsString() additionalCostType?: string;
  @IsOptional() @IsNumber() @Min(0) additionalCost?: number;
  @IsInt() @Min(1) durationMin: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() imageUrl?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) imageUrls?: string[];
  // Cashback próprio do serviço — separado da comissão do profissional (ground-truth Belasis).
  @IsOptional() @IsNumber() @Min(0) cashbackPercent?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) defaultCommissionPercent?: number;
  @IsOptional() @IsBoolean() onlineBookable?: boolean;
  @IsOptional() @IsBoolean() favorite?: boolean;
  @IsOptional() @IsBoolean() visible?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateServiceDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  // Wave 2/3: tipo de preço (fixo|a_partir_de) e tipo de custo adicional (percent|value).
  @IsOptional() @IsString() priceType?: string;
  @IsOptional() @IsString() additionalCostType?: string;
  @IsOptional() @IsNumber() @Min(0) additionalCost?: number;
  @IsOptional() @IsInt() @Min(1) durationMin?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() imageUrl?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) imageUrls?: string[];
  // Cashback próprio do serviço — separado da comissão do profissional (ground-truth Belasis).
  @IsOptional() @IsNumber() @Min(0) cashbackPercent?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) defaultCommissionPercent?: number;
  @IsOptional() @IsBoolean() onlineBookable?: boolean;
  @IsOptional() @IsBoolean() favorite?: boolean;
  @IsOptional() @IsBoolean() visible?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateServiceCategoryDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsInt() displayOrder?: number;
}
