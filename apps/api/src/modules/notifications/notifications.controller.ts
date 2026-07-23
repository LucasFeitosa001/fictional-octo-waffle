import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
  NotificationSettingsService,
  type NotificationAutomationSettings,
  type FollowUpSettings,
} from './notification-settings.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listForCompany(companyId, {
      unreadOnly: unread === '1' || unread === 'true',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('companyId') companyId: string) {
    return this.service.unreadCount(companyId);
  }

  @Post(':id/read')
  markRead(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.markRead(companyId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser('companyId') companyId: string) {
    return this.service.markAllRead(companyId);
  }
}

/**
 * Per-company toggles for the AUTOMATIC client-facing messages (confirmation,
 * cancellation, reminder, follow-up). Separate route so the salon owner can
 * silence a whole class of automatic client messages. Default (when never set):
 * only follow-up on.
 */
@UseGuards(JwtAuthGuard)
@Controller('notification-settings')
export class NotificationSettingsController {
  constructor(private readonly settings: NotificationSettingsService) {}

  @Get()
  get(@CurrentUser('companyId') companyId: string) {
    return this.settings.get(companyId);
  }

  @Patch()
  update(
    @CurrentUser('companyId') companyId: string,
    @Body() body: Partial<NotificationAutomationSettings>,
  ) {
    // Only accept the four known booleans; ignore anything else in the body.
    const patch: Partial<NotificationAutomationSettings> = {};
    if (typeof body?.confirmation === 'boolean') patch.confirmation = body.confirmation;
    if (typeof body?.cancellation === 'boolean') patch.cancellation = body.cancellation;
    if (typeof body?.reminder === 'boolean') patch.reminder = body.reminder;
    if (typeof body?.followUp === 'boolean') patch.followUp = body.followUp;
    return this.settings.update(companyId, patch);
  }

  // ------------------------------------------------ rich follow-up config

  /** Full follow-up config (message template, delay, recurrence, booking link). */
  @Get('follow-up')
  getFollowUp(@CurrentUser('companyId') companyId: string) {
    return this.settings.getFollowUp(companyId);
  }

  @Patch('follow-up')
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
