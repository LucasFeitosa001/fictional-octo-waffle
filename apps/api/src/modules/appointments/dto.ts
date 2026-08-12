import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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
  @IsOptional() @IsBoolean() remindClient?: boolean;
  /** Envia a mensagem de horário marcado/confirmado para este agendamento. */
  @IsOptional() @IsBoolean() notifyConfirmation?: boolean;
  /** Envia uma mensagem ao cliente se este agendamento for cancelado. */
  @IsOptional() @IsBoolean() notifyCancellation?: boolean;
  @IsDateString() start: string;
  @IsOptional() @IsDateString() end?: string;
  @IsOptional() @IsString() notes?: string;
  /**
   * "Encaixar agendamento": permite marcar em cima de um horário JÁ ocupado do
   * mesmo profissional. Pedido do salão — a mesma profissional atende duas
   * clientes no mesmo horário (ex.: uma com a tinta agindo).
   * O toggle já existia na tela mas nunca era enviado, então ligá-lo não fazia
   * nada e a pessoa tomava "horário ocupado" mesmo assim.
   */
  @IsOptional() @IsBoolean() squeezeIn?: boolean;
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

/**
 * Criação atômica de uma série. `start`/`end` representam a primeira ocorrência
 * e `additionalStarts` as demais; todas usam a mesma duração e configuração.
 */
export class CreateAppointmentSeriesDto extends CreateAppointmentDto {
  @IsArray()
  @ArrayMaxSize(60)
  @IsDateString({}, { each: true })
  additionalStarts: string[];

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}

export class UpdateAppointmentDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsBoolean() remindClient?: boolean;
  @IsOptional() @IsBoolean() notifyConfirmation?: boolean;
  @IsOptional() @IsBoolean() notifyCancellation?: boolean;
  @IsOptional() @IsDateString() start?: string;
  @IsOptional() @IsDateString() end?: string;
  @IsOptional() @IsString() notes?: string;
  /**
   * "Encaixar agendamento" ao REAGENDAR. Mesma regra do create: permite mover o
   * agendamento para um horário já ocupado do mesmo profissional. Sem isto o
   * encaixe cobria só metade do fluxo — dava para criar em cima, mas não para
   * mover para cima, que é o caso mais comum na recepção.
   */
  @IsOptional() @IsBoolean() squeezeIn?: boolean;
  // Reconfigura o aviso personalizado ao editar o agendamento.
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentFollowUpDto)
  followUp?: AppointmentFollowUpDto;
}

/**
 * Disparo manual e auditável da confirmação. `authorize=true` é deliberadamente
 * obrigatório: autenticação/permissão identificam QUEM pode agir, mas este campo
 * registra que aquela chamada autorizou especificamente este agendamento.
 */
/**
 * Reenvio manual de um aviso que não saiu. Mesmo contrato do envio de
 * confirmação: uma pessoa autoriza explicitamente, e a requestKey torna o retry
 * HTTP idempotente (não cria uma segunda mensagem). Ver estudo 82.
 */
/**
 * Envio manual do acompanhamento. Mesma exigência de autorização explícita da
 * confirmação — o botão antigo disparava sem nada disso. Ver estudo 86.
 */
/** Mensagem livre para a cliente, a partir do agendamento. Ver estudo 87. */
export class SendAppointmentMessageDto {
  @Equals(true, { message: 'Confirme explicitamente o envio da mensagem.' })
  authorize: true;

  @IsUUID('4', {
    message: 'A chave de segurança do envio é inválida. Tente novamente.',
  })
  requestKey: string;

  @IsString() message: string;
}

export class SendAppointmentFollowUpDto {
  @Equals(true, {
    message: 'Confirme explicitamente o envio do acompanhamento.',
  })
  authorize: true;

  @IsUUID('4', {
    message: 'A chave de segurança do envio é inválida. Tente novamente.',
  })
  requestKey: string;

  /** Modelo escolhido na tela; ignorado quando `message` vem preenchida. */
  @IsOptional() @IsString() templateId?: string;

  /** Texto editado só para este envio. */
  @IsOptional() @IsString() message?: string;
}

export class ResendAppointmentMessageDto {
  @Equals(true, {
    message: 'Confirme explicitamente o reenvio desta mensagem.',
  })
  authorize: true;

  @IsUUID('4', {
    message: 'A chave de segurança do envio é inválida. Tente novamente.',
  })
  requestKey: string;
}

export class SendAppointmentConfirmationDto {
  @Equals(true, {
    message:
      'Confirme explicitamente a autorização deste agendamento antes de enviar.',
  })
  authorize: true;

  @IsUUID('4', {
    message: 'A chave de segurança do envio é inválida. Tente novamente.',
  })
  requestKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  templateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000, {
    message: 'A mensagem deve ter no máximo 2000 caracteres.',
  })
  message?: string;

  /** Reenvio intencional após o backend detectar uma confirmação anterior. */
  @IsOptional()
  @IsBoolean()
  allowResend?: boolean;
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

export class StatusDto {
  @IsIn(STATUSES) status: (typeof STATUSES)[number];
  @IsOptional() @IsString() reason?: string;
}

export class SuggestDto {
  @IsString() suggestion: string;
}
