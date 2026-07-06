import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AppointmentItemDto {
  @IsString() serviceId: string;
  @IsOptional() @IsString() professionalId?: string;
}

export class CreateAppointmentDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsDateString() start: string;
  @IsOptional() @IsDateString() end?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppointmentItemDto)
  items?: AppointmentItemDto[];
}

export class UpdateAppointmentDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsDateString() start?: string;
  @IsOptional() @IsDateString() end?: string;
  @IsOptional() @IsString() notes?: string;
}

const STATUSES = [
  'scheduled',
  'confirmed',
  'unconfirmed',
  'waiting',
  'in_progress',
  'done',
  'finished',
  'canceled',
] as const;

export class StatusDto {
  @IsIn(STATUSES) status: (typeof STATUSES)[number];
  @IsOptional() @IsString() reason?: string;
}

export class SuggestDto {
  @IsString() suggestion: string;
}
