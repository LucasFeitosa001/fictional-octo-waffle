import { IsBoolean, IsEmail, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() secondaryPhone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsISO8601() birthday?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() secondaryPhone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsISO8601() birthday?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
