import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsNumber() @Min(0) additionalCost?: number;
  @IsInt() @Min(1) durationMin: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() imageUrl?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) imageUrls?: string[];
  // Cashback próprio do serviço — separado da comissão do profissional (ground-truth Belasis).
  @IsOptional() @IsNumber() @Min(0) cashbackPercent?: number;
  @IsOptional() @IsBoolean() onlineBookable?: boolean;
  @IsOptional() @IsBoolean() favorite?: boolean;
  @IsOptional() @IsBoolean() visible?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateServiceDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsNumber() @Min(0) additionalCost?: number;
  @IsOptional() @IsInt() @Min(1) durationMin?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() imageUrl?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) imageUrls?: string[];
  // Cashback próprio do serviço — separado da comissão do profissional (ground-truth Belasis).
  @IsOptional() @IsNumber() @Min(0) cashbackPercent?: number;
  @IsOptional() @IsBoolean() onlineBookable?: boolean;
  @IsOptional() @IsBoolean() favorite?: boolean;
  @IsOptional() @IsBoolean() visible?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateServiceCategoryDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsInt() displayOrder?: number;
}
