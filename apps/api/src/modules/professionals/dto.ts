import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProfessionalDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() profession?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsISO8601() birthday?: string;
  @IsOptional() @IsBoolean() onlineBookable?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateProfessionalDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() profession?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsISO8601() birthday?: string;
  @IsOptional() @IsBoolean() onlineBookable?: boolean;
  @IsOptional() @IsBoolean() notifyWhatsapp?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ScheduleDto {
  @IsInt() @Min(0) @Max(6) weekday: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime: string;
}

export class SetServicesDto {
  @IsString({ each: true }) serviceIds: string[];
}

export class CommissionRuleDto {
  @IsString() scopeType: 'service' | 'product' | 'category' | 'all';
  @IsOptional() @IsString() scopeId?: string;
  @IsString() type: 'percent' | 'fixed';
  @IsNumber() value: number;
}
