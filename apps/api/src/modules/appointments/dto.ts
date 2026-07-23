import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AppointmentItemDto {
  @IsString() serviceId: string;
  @IsOptional() @IsString() professionalId?: string;
}

// Unidades de tempo aceitas no atraso do "Avisar o cliente" (segundos → dias).
// Espelha o TimeUnit da config global de follow-up para permitir testes rápidos
// via segundos.
const FOLLOWUP_DELAY_UNITS = ['seconds', 'minutes', 'hours', 'days'] as const;
// Âncora do atraso: a partir de agora, antes do início ou depois do fim.
const FOLLOWUP_WHEN = ['before', 'after', 'from_now'] as const;

/**
 * Aviso/follow-up PERSONALIZADO agendado a partir do próprio drawer de
 * agendamento (distinto do lembrete fixo 24h/2h e da config global). Quando
 * `enabled`, o backend enfileira UM job atrasado que monta a mensagem (template
 * escolhido OU `message` custom, com as variáveis {cliente}{estabelecimento}
 * {servico}{link}) e a envia por WhatsApp ao cliente.
 */
export class AppointmentFollowUpDto {
  @IsBoolean() enabled: boolean;
  // Mensagem custom (tem precedência sobre o template quando preenchida).
  @IsOptional() @IsString() message?: string;
  // Id de um dos modelos prontos (followupTemplates) — usado quando não há
  // mensagem custom.
  @IsOptional() @IsString() templateId?: string;
  // Quantidade de tempo do atraso (combinada com delayUnit).
  @IsInt() @Min(1) delayValue: number;
  @IsIn(FOLLOWUP_DELAY_UNITS)
  delayUnit: (typeof FOLLOWUP_DELAY_UNITS)[number];
  // Âncora do atraso (default 'after' — depois do atendimento).
  @IsOptional() @IsIn(FOLLOWUP_WHEN) when?: (typeof FOLLOWUP_WHEN)[number];
  // Anexar o link público de reagendamento à mensagem.
  @IsOptional() @IsBoolean() includeLink?: boolean;
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
  // Aviso personalizado ao cliente agendado a partir do drawer.
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentFollowUpDto)
  followUp?: AppointmentFollowUpDto;
}

export class UpdateAppointmentDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsDateString() start?: string;
  @IsOptional() @IsDateString() end?: string;
  @IsOptional() @IsString() notes?: string;
  // Reconfigura o aviso personalizado ao editar o agendamento.
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentFollowUpDto)
  followUp?: AppointmentFollowUpDto;
}

/**
 * Bloqueio de horário ("Ocupar horários"): cria um Appointment SEM cliente e
 * SEM itens, servindo como indisponibilidade que ocupa a agenda do profissional
 * (mesmo mecanismo de colisão dos agendamentos ativos). `reason` vira as notes
 * do bloqueio para exibição na agenda.
 */
export class BlockTimeDto {
  @IsString() professionalId: string;
  @IsDateString() start: string;
  @IsDateString() end: string;
  @IsOptional() @IsString() reason?: string;
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
