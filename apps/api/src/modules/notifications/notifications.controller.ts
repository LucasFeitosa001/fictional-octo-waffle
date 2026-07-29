import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
  NotificationSettingsService,
  type NotificationAutomationSettings,
  type FollowUpSettings,
} from './notification-settings.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import {
  CONFIRMATION_TEMPLATE_VARIABLES,
  unresolvedConfirmationVariables,
} from './confirmation.templates';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    // `type` aceita um ou mais tipos (CSV): ?type=appointment.created,appointment.confirmed
    @Query('type') type?: string,
  ) {
    return this.service.listForCompany(companyId, {
      unreadOnly: unread === '1' || unread === 'true',
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      types: parseTypes(type),
    });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('companyId') companyId: string) {
    return this.service.unreadCount(companyId);
  }

  /** Contagem por tipo (total + não-lidas) para a página de categorias. */
  @Get('summary')
  summary(@CurrentUser('companyId') companyId: string) {
    return this.service.summaryByType(companyId);
  }

  @Post(':id/read')
  markRead(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.markRead(companyId, id);
  }

  @Post('read-all')
  markAllRead(
    @CurrentUser('companyId') companyId: string,
    // Opcional: marca só as de certos tipos (usado pela página de detalhe).
    @Query('type') type?: string,
  ) {
    return this.service.markAllRead(companyId, parseTypes(type));
  }
}

/** Divide o CSV de tipos vindo do query param; ignora vazios. */
function parseTypes(type?: string): string[] | undefined {
  if (!type) return undefined;
  const list = type
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

/**
 * Per-company toggles for the AUTOMATIC client-facing messages (confirmation,
 * cancellation, reminder, follow-up). Separate route so the salon owner can
 * silence a whole class of automatic client messages. Default (when never set):
 * everything off until the owner explicitly opts in.
 */
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('notification-settings')
export class NotificationSettingsController {
  constructor(private readonly settings: NotificationSettingsService) {}

  @Get()
  @RequirePermission('config:view', 'config:manage')
  get(@CurrentUser('companyId') companyId: string) {
    return this.settings.get(companyId);
  }

  @Patch()
  @RequirePermission('config:manage')
  update(
    @CurrentUser('companyId') companyId: string,
    @Body() body: Partial<NotificationAutomationSettings>,
  ) {
    // Only accept the five known booleans; ignore anything else in the body.
    const patch: Partial<NotificationAutomationSettings> = {};
    if (typeof body?.confirmation === 'boolean') patch.confirmation = body.confirmation;
    if (typeof body?.cancellation === 'boolean') patch.cancellation = body.cancellation;
    if (typeof body?.reminder === 'boolean') patch.reminder = body.reminder;
    if (typeof body?.followUp === 'boolean') patch.followUp = body.followUp;
    if (typeof body?.notifyProfessional === 'boolean')
      patch.notifyProfessional = body.notifyProfessional;
    return this.settings.update(companyId, patch);
  }

  // ------------------------------------------ confirmation message templates

  @Get('confirmation-templates')
  @RequirePermission('config:view', 'config:manage')
  getConfirmationTemplates(
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.settings.getConfirmationTemplates(companyId);
  }

  @Put('confirmation-templates')
  @RequirePermission('config:manage')
  updateConfirmationTemplates(
    @CurrentUser('companyId') companyId: string,
    @Body()
    body: {
      defaultTemplateId?: unknown;
      templates?: unknown;
    },
  ) {
    if (!Array.isArray(body?.templates)) {
      throw new BadRequestException('Informe a lista de modelos de confirmação.');
    }
    if (body.templates.length > 20) {
      throw new BadRequestException(
        'É possível salvar no máximo 20 modelos de confirmação.',
      );
    }
    const allowedVariables = new Set<string>(CONFIRMATION_TEMPLATE_VARIABLES);
    for (const raw of body.templates) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new BadRequestException('Modelo de confirmação inválido.');
      }
      const template = raw as Record<string, unknown>;
      const id = typeof template.id === 'string' ? template.id.trim() : '';
      const label =
        typeof template.label === 'string' ? template.label.trim() : '';
      const message =
        typeof template.message === 'string' ? template.message.trim() : '';
      if (!/^custom-[a-z0-9-]{1,80}$/i.test(id)) {
        throw new BadRequestException('Identificador do modelo inválido.');
      }
      if (!label || label.length > 80) {
        throw new BadRequestException(
          'O nome do modelo deve ter entre 1 e 80 caracteres.',
        );
      }
      if (!message || message.length > 2_000) {
        throw new BadRequestException(
          'A mensagem do modelo deve ter entre 1 e 2000 caracteres.',
        );
      }
      const unknown = unresolvedConfirmationVariables(message).filter(
        (variable) => !allowedVariables.has(variable),
      );
      if (unknown.length > 0) {
        throw new BadRequestException(
          `Variável não reconhecida no modelo: {${unknown[0]}}.`,
        );
      }
    }
    return this.settings.updateConfirmationTemplates(companyId, body);
  }

  // ------------------------------------------------ rich follow-up config

  /** Full follow-up config (message template, delay, recurrence, booking link). */
  @Get('follow-up')
  @RequirePermission('config:view', 'config:manage')
  getFollowUp(@CurrentUser('companyId') companyId: string) {
    return this.settings.getFollowUp(companyId);
  }

  @Patch('follow-up')
  @RequirePermission('config:manage')
  updateFollowUp(
    @CurrentUser('companyId') companyId: string,
    @Body() body: Partial<FollowUpSettings>,
  ) {
    // Accept only known fields with the right primitive type; the service clamps
    // the numbers into sane ranges (idempotent, defaults applied).
    const patch: Partial<FollowUpSettings> = {};
    if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled;
    if (typeof body?.message === 'string') patch.message = body.message;
    // New value+unit fields (the service normalizes/clamps them to seconds).
    if (typeof body?.delayValue === 'number') patch.delayValue = body.delayValue;
    if (typeof body?.delayUnit === 'string') patch.delayUnit = body.delayUnit;
    if (typeof body?.delaySeconds === 'number') patch.delaySeconds = body.delaySeconds;
    // Legacy compat: still accept a raw delayHours so old clients keep working.
    if (typeof body?.delayHours === 'number') patch.delayHours = body.delayHours;
    if (typeof body?.recurring === 'boolean') patch.recurring = body.recurring;
    if (typeof body?.recurringValue === 'number') patch.recurringValue = body.recurringValue;
    if (typeof body?.recurringUnit === 'string') patch.recurringUnit = body.recurringUnit;
    if (typeof body?.recurringSeconds === 'number')
      patch.recurringSeconds = body.recurringSeconds;
    if (typeof body?.recurringDays === 'number') patch.recurringDays = body.recurringDays;
    if (typeof body?.maxRecurrences === 'number') patch.maxRecurrences = body.maxRecurrences;
    if (typeof body?.includeBookingLink === 'boolean')
      patch.includeBookingLink = body.includeBookingLink;
    return this.settings.updateFollowUp(companyId, patch);
  }
}
