import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueuesService } from './queues.service';
import { AppointmentRemindersProcessor } from './processors/appointment-reminders.processor';
import { FollowUpsProcessor } from './processors/follow-ups.processor';
import { CampaignsProcessor } from './processors/campaigns.processor';
import {
  QUEUE_APPOINTMENT_REMINDERS,
  QUEUE_FOLLOW_UPS,
  QUEUE_CAMPAIGNS,
} from './queue-names';

/**
 * BullMQ engine for the message automations. Registers the Redis connection and
 * the three queues, wires the producer (QueuesService) and the three processors.
 *
 * The Redis connection comes from REDIS_URL. BullMQ opens the connection lazily,
 * so the app still boots when Redis is down (jobs just don't run) — matching the
 * "DB optional in dev" posture of PrismaService.
 *
 * CampaignsModule is imported via forwardRef because it also imports QueuesModule
 * (the campaign dispatch enqueues through QueuesService) — a two-way link.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: { url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6381' },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_APPOINTMENT_REMINDERS },
      { name: QUEUE_FOLLOW_UPS },
      { name: QUEUE_CAMPAIGNS },
    ),
    WhatsappModule,
    forwardRef(() => CampaignsModule),
    // Provides NotificationSettingsService so the reminder/follow-up processors
    // can honor the per-company automation toggles. No forwardRef needed:
    // NotificationsModule does not import QueuesModule (no cycle).
    NotificationsModule,
  ],
  providers: [
    QueuesService,
    AppointmentRemindersProcessor,
    FollowUpsProcessor,
    CampaignsProcessor,
  ],
  exports: [QueuesService],
})
export class QueuesModule {}
