import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

/**
 * Módulo de convites de profissional. Exporta InvitesService para o módulo
 * professionals reusar no endpoint protegido POST /professionals/:id/invite.
 *
 * Importa WhatsappModule para disparar o convite pelo WhatsApp CONECTADO do
 * salão (mesmo socket/outbox usado pelos follow-ups automáticos).
 */
@Module({
  imports: [WhatsappModule],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
