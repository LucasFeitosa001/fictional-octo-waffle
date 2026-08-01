import { Module } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AuthModule } from '../auth/auth.module';
import { VoltrController, VoltrWhatsappController } from './voltr.controller';
import { VoltrForwarderService } from './voltr-forwarder.service';
import { VoltrService } from './voltr.service';
import { VoltrAgendaController } from './voltr-agenda.controller';
import { VoltrAgendaService } from './voltr-agenda.service';
import { AppointmentsModule } from '../appointments/appointments.module';

/**
 * Integração com a Voltr (estudo 68): embed do Chat/CRM no painel e ponte de
 * WhatsApp pelos dois sentidos. Sem env configurada, o módulo sobe inerte —
 * o encaminhador não manda nada e o embed responde 503 explicando.
 */
@Module({
  imports: [WhatsappModule, AuthModule, AppointmentsModule],
  controllers: [VoltrController, VoltrWhatsappController, VoltrAgendaController],
  providers: [VoltrService, VoltrForwarderService, VoltrAgendaService],
  exports: [VoltrService],
})
export class VoltrModule {}
