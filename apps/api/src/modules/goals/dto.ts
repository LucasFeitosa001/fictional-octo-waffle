import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

export type GoalKindDto = 'sales' | 'appointments' | 'customers' | 'commission';
export type ScopeType = 'service' | 'product' | 'category' | 'all';

export class CreateGoalDto {
  @IsString() @Matches(/^\d{4}-\d{2}$/, { message: 'period deve ser YYYY-MM' })
  period: string;
  @IsEnum(['sales', 'appointments', 'customers', 'commission']) kind: GoalKindDto;
  @IsEnum(['service', 'product', 'category', 'all']) scopeType: ScopeType;
  @IsOptional() @IsString() scopeId?: string;
  // Escopo por profissional: quando setado, o progresso é calculado só p/ ele.
  @IsOptional() @IsString() employeeId?: string;
  @IsNumber() @Min(0) target: number;
}

export class UpdateGoalDto {
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}$/, { message: 'period deve ser YYYY-MM' })
  period?: string;
  @IsOptional() @IsEnum(['sales', 'appointments', 'customers', 'commission']) kind?: GoalKindDto;
  @IsOptional() @IsEnum(['service', 'product', 'category', 'all']) scopeType?: ScopeType;
  @IsOptional() @IsString() scopeId?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() employeeId?: string | null;
  @IsOptional() @IsNumber() @Min(0) target?: number;
}
