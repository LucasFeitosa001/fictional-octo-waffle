import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PackageTemplateItemDto {
  @IsString() serviceId: string;
  @IsInt() @Min(1) sessions: number;
}

export class CreatePackageTemplateDto {
  @IsString() @MinLength(2) name: string;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsInt() @Min(0) validityDays?: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PackageTemplateItemDto)
  items: PackageTemplateItemDto[];
}

export class UpdatePackageTemplateDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(0) validityDays?: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PackageTemplateItemDto)
  items?: PackageTemplateItemDto[];
}

export class CreateCustomerPackageDto {
  @IsString() customerId: string;
  @IsOptional() @IsString() templateId?: string;
  /** override price; defaults to template price when omitted */
  @IsOptional() @IsNumber() @Min(0) price?: number;
}

export class ConsumePackageItemDto {
  /** optional order this consumption is tied to */
  @IsOptional() @IsString() orderId?: string;
  /** optional appointment this consumption is tied to (informational) */
  @IsOptional() @IsString() appointmentId?: string;
}
