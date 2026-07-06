import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateProductDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() imageUrl?: string | null;
  @IsNumber() @Min(0) salePrice: number;
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @IsNumber() @Min(0) stock?: number;
  @IsOptional() @IsNumber() @Min(0) minStock?: number;
  @IsOptional() @IsNumber() @Min(0) cashbackPercent?: number;
  @IsOptional() @IsBoolean() favorite?: boolean;
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() imageUrl?: string | null;
  @IsOptional() @IsNumber() @Min(0) salePrice?: number;
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @IsNumber() @Min(0) stock?: number;
  @IsOptional() @IsNumber() @Min(0) minStock?: number;
  @IsOptional() @IsNumber() @Min(0) cashbackPercent?: number;
  @IsOptional() @IsBoolean() favorite?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export enum StockMovementType {
  in = 'in',
  out = 'out',
  adjust = 'adjust',
}

export class StockMovementDto {
  @IsEnum(StockMovementType) type: StockMovementType;
  @IsNumber() @Min(0) quantity: number;
  @IsOptional() @IsString() reason?: string;
}

export class CreateProductCategoryDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateProductCategoryDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateBrandDto {
  @IsString() @MinLength(2) name: string;
}

export class UpdateBrandDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
}
