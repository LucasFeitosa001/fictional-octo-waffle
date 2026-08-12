import { Body, Controller, Logger, Param, Post } from '@nestjs/common';
import { UazapiWebhookService } from './uazapi-webhook.service';

/**
 * Callback da uazapi (estudo 158).
 *
 * PÚBLICO por natureza — quem chama é o provedor, não um usuário logado. A
 * proteção é um segredo de alta entropia no PATH (`UAZAPI_WEBHOOK_SECRET`),
 * comparado antes de qualquer leitura do corpo. Não é assinatura HMAC porque a
 * uazapi não documenta header de assinatura; é a melhor defesa disponível.
 *
 * Responde 200 mesmo quando ignora o evento: reentregar não conserta um payload
 * que não sabemos ler, e o provedor ficaria reenviando para sempre.
 */
@Controller('whatsapp/uazapi')
export class UazapiWebhookController {
  private readonly logger = new Logger(UazapiWebhookController.name);

  constructor(private readonly webhook: UazapiWebhookService) {}

  @Post('webhook/:segredo')
  async receber(
    @Param('segredo') segredo: string,
    @Body() corpo: unknown,
  ): Promise<{ ok: boolean }> {
    const esperado = (process.env.UAZAPI_WEBHOOK_SECRET ?? '').trim();
    if (!esperado || segredo !== esperado) {
      // Não diz o motivo nem registra o valor recebido: quem está sondando não
      // deve descobrir se errou o segredo ou se ele sequer existe.
      this.logger.warn('Callback da uazapi recusado: segredo inválido.');
      return { ok: false };
    }
    await this.webhook.processar(corpo);
    return { ok: true };
  }
}
