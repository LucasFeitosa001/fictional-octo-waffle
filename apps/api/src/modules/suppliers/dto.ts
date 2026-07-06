import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSupplierDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() stateRegistration?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() addressJson?: unknown;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateSupplierDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() stateRegistration?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() addressJson?: unknown;
  @IsOptional() @IsBoolean() active?: boolean;
}
