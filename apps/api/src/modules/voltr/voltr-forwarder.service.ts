import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { VoltrService } from './voltr.service';

/**
 * Encaminha para a Voltr cada mensagem que o WhatsApp do salão recebe
 * (estudo 68).
 *
 * ENTRA COMO CONSUMIDOR ADICIONAL: `addInboundHandler` acrescenta um ouvinte ao
 * conjunto (`whatsapp.service.ts:335`), sem substituir o handler do fluxo de
 * agendamento. E é fire-and-forget: erro aqui vira log, nunca derruba o
 * atendimento — a Voltr é integração, não caminho crítico.
 */
@Injectable()
export class VoltrForwarderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VoltrForwarderService.name);
  private cancelar: (() => void) | null = null;

  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly voltr: VoltrService,
  ) {}

  onModuleInit(): void {
    this.cancelar = this.whatsapp.addInboundHandler((msg) => {
      // Mensagem que o próprio salão mandou não é "entrada" do cliente.
      if (msg.fromMe) return;
      const texto = msg.text?.trim();
      if (!texto) return;
      void this.voltr
        .encaminharInbound({
          companyId: msg.companyId,
          fromDigits: msg.fromDigits,
          text: texto,
          externalId: msg.messageId,
          nomeCliente: msg.pushName,
        })
        .catch((err: Error) => {
          this.logger.warn(
            `Não deu para encaminhar a mensagem para a Voltr: ${err.message}`,
          );
        });
    });
  }

  onModuleDestroy(): void {
    this.cancelar?.();
    this.cancelar = null;
  }
}
