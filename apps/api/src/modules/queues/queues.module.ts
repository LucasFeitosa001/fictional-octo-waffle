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
 * A conexão vem de REDIS_URL. RESILIÊNCIA (app sobe mesmo sem Redis):
 *   - `maxRetriesPerRequest: null` — EXIGIDO pelo BullMQ (workers usam comandos
 *     bloqueantes; passar outro valor emite warning/erro).
 *   - `enableOfflineQueue: false` — o ioredis lança na hora em vez de ENFILEIRAR
 *     comandos enquanto o Redis está fora. É isso que evita o `add(...)` do boot
 *     (ensureBirthdayRepeatable) travar indefinidamente: ele falha rápido e o
 *     onModuleInit engole o erro (ver QueuesService). Com Redis disponível, tudo
 *     funciona normalmente.
 *   - `retryStrategy` com teto — reconexão em backoff limitado (1s→…→10s), sem
 *     loop apertado/ruidoso quando o Redis está indisponível.
 * Assim as filas DEGRADAM (jobs não rodam) sem derrubar a API — mesma postura do
 * "DB opcional em dev" do PrismaService.
 *
 * CampaignsModule is imported via forwardRef because it also imports QueuesModule
 * (the campaign dispatch enqueues through QueuesService) — a two-way link.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6381',
          // Falha rápido em vez de bloquear/enfileirar offline (ver bloco acima).
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
          retryStrategy: (times: number) => Math.min(1000 * times, 10000),
        },
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
