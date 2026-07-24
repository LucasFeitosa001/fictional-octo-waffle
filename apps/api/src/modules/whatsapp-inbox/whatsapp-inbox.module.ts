import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuthModule } from '../auth/auth.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { WhatsappInboxController } from './whatsapp-inbox.controller';
import { WhatsappInboxService } from './whatsapp-inbox.service';

@Module({
  imports: [AuthModule, WhatsappModule, AppointmentsModule],
  controllers: [WhatsappInboxController],
  providers: [WhatsappInboxService],
  exports: [WhatsappInboxService],
})
export class WhatsappInboxModule {}
