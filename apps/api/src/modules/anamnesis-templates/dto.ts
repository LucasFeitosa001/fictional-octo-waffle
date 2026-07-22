import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAnamnesisTemplateDto {
  @IsString() @MinLength(1) name: string;
  // Lista de perguntas configuráveis (aceita array ou objeto de config).
  @IsOptional() @IsArray() questionsJson?: unknown[];
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateAnamnesisTemplateDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsArray() questionsJson?: unknown[];
  @IsOptional() @IsBoolean() active?: boolean;
}
