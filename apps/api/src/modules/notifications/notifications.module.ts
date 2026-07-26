import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationSettingsService } from './notification-settings.service';
import {
  NotificationsController,
  NotificationSettingsController,
} from './notifications.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
import { WhatsappReminderPollerService } from './whatsapp-reminder-poller.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, WhatsappModule, EmailModule],
  controllers: [NotificationsController, NotificationSettingsController],
  providers: [
    NotificationsService,
    NotificationSettingsService,
    WhatsappReminderPollerService,
  ],
  exports: [NotificationsService, NotificationSettingsService],
})
export class NotificationsModule {}
