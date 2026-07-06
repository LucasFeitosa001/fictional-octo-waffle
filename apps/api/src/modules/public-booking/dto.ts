import {
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Guest identity for a quick booking without a logged-in account.
export class BookingGuestDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
}

export class CreateBookingDto {
  @IsString() serviceId: string;
  @IsOptional() @IsArray() @IsString({ each: true }) serviceIds?: string[];
  @IsString() professionalId: string;
  @IsDateString() start: string;
  @IsOptional() @IsString() notes?: string;
  // Logged-in customer's WhatsApp/phone, sent when their account has none yet
  // (e.g. signed up with Google). Persisted on the customer for notifications.
  @IsOptional() @IsString() phone?: string;
  // Present for guest (not logged in) bookings. Ignored when a customer session
  // is detected, in which case the identity comes from the logged-in user.
  @IsOptional()
  @ValidateNested()
  @Type(() => BookingGuestDto)
  guest?: BookingGuestDto;
}

// Edit the logged-in customer's own profile from the club account page. Both
// fields optional so the form can patch just the name or just the phone.
export class UpdateMyProfileDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() phone?: string;
}

// A customer's star rating (+ optional comment) for a finished appointment.
export class CreateReviewDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
