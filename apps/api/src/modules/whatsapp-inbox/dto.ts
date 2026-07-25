import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class WhatsappFaqDto {
  @IsString()
  @MaxLength(300)
  question!: string;

  @IsString()
  @MaxLength(2000)
  answer!: string;
}

export class UpdateAiAttendantDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(80) agentName?: string;
  @IsOptional() @IsString() @MaxLength(1000) greeting?: string;
  @IsOptional()
  @IsIn(['simpatico', 'profissional', 'direto'])
  tone?: 'simpatico' | 'profissional' | 'direto';
  @IsOptional() @IsBoolean() autoReply?: boolean;
  @IsOptional() @IsBoolean() bookingViaChat?: boolean;
  @IsOptional() @IsBoolean() handoffEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(12000) knowledgeBase?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WhatsappFaqDto)
  faq?: WhatsappFaqDto[];
}

export class UpdateWhatsappConversationDto {
  @IsOptional() @IsBoolean() handledByAi?: boolean;
  @IsOptional() @IsBoolean() resolved?: boolean;
  @IsOptional() @IsBoolean() read?: boolean;
}

export class SendWhatsappInboxMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text!: string;
}

export class StartWhatsappConversationDto extends SendWhatsappInboxMessageDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}
