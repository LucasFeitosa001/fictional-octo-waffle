import { Module } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AuthModule } from '../auth/auth.module';
import { VoltrController, VoltrWhatsappController } from './voltr.controller';
import { VoltrForwarderService } from './voltr-forwarder.service';
import { VoltrService } from './voltr.service';

/**
 * Integração com a Voltr (estudo 68): embed do Chat/CRM no painel e ponte de
 * WhatsApp pelos dois sentidos. Sem env configurada, o módulo sobe inerte —
 * o encaminhador não manda nada e o embed responde 503 explicando.
 */
@Module({
  imports: [WhatsappModule, AuthModule],
  controllers: [VoltrController, VoltrWhatsappController],
  providers: [VoltrService, VoltrForwarderService],
  exports: [VoltrService],
})
export class VoltrModule {}
