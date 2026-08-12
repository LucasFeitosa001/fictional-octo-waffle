import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Interpreta o callback da uazapi (estudo 158).
 *
 * O ponto delicado: o OpenAPI da uazapi lista os EVENTOS (`messages`,
 * `messages_update`, `connection`) mas NÃO documenta o envelope do JSON. Então
 * este parser é deliberadamente desconfiado — reconhece o que consegue mapear
 * com segurança e, diante de formato desconhecido, registra e NÃO promove
 * status.
 *
 * Marcar "entregue" por suposição é pior que não marcar: a regra do projeto é
 * que "enviado" não significa "recebido", e só o ACK confirma entrega.
 */

/** Status que sabemos representar no outbox. */
type StatusAck = 'delivered' | 'read';

@Injectable()
export class UazapiWebhookService {
  private readonly logger = new Logger(UazapiWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async processar(corpo: unknown): Promise<void> {
    if (!corpo || typeof corpo !== 'object') {
      this.logger.warn('Callback da uazapi ignorado: corpo não é um objeto.');
      return;
    }
    const evento = this.textoDe(corpo, ['event', 'EventType', 'type']);
    // Só o update de mensagem carrega ACK. `messages` (entrada) e `connection`
    // são registrados e ignorados por ora — a inbox da uazapi é passo seguinte.
    if (evento && !/update/i.test(evento)) {
      this.logger.debug(`Callback da uazapi: evento "${evento}" sem tratamento — ignorado.`);
      return;
    }

    const ack = this.lerAck(corpo);
    if (!ack) {
      // Este log é o que vai revelar o envelope real na primeira mensagem que
      // passar por aqui. Sem texto da mensagem nem telefone — só a forma.
      this.logger.warn(
        `Callback da uazapi em formato não reconhecido; nenhum status alterado. Chaves: ${this.formaDe(corpo)}`,
      );
      return;
    }

    // Casa pelo id que gravamos no envio. Sem id não há como saber QUAL
    // mensagem foi entregue — e adivinhar marcaria a errada.
    const alvo = await this.prisma.client.whatsappOutbox.findFirst({
      where: { whatsappMessageId: ack.messageId },
      select: { id: true, status: true, companyId: true },
    });
    if (!alvo) {
      this.logger.debug(`ACK da uazapi para mensagem desconhecida (${ack.messageId}).`);
      return;
    }

    // NÃO regride: uma mensagem já `read` não volta para `delivered` se os
    // eventos chegarem fora de ordem, o que acontece com frequência.
    const ordem: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3 };
    const atual = ordem[alvo.status] ?? 0;
    const novo = ordem[ack.status] ?? 0;
    if (novo <= atual) return;

    await this.prisma.client.whatsappOutbox.update({
      where: { id: alvo.id },
      data: { status: ack.status },
    });
    this.logger.log(
      `Outbox ${alvo.id}: ${alvo.status} → ${ack.status} pelo ACK da uazapi (company=${alvo.companyId}).`,
    );
  }

  /**
   * Extrai `{ messageId, status }` do envelope, tentando os caminhos plausíveis.
   * Devolve null quando não encontra os DOIS com confiança — meio-reconhecido é
   * o mesmo que não reconhecido.
   */
  private lerAck(corpo: unknown): { messageId: string; status: StatusAck } | null {
    const raizes = [corpo, this.objetoDe(corpo, 'message'), this.objetoDe(corpo, 'data')];
    for (const raiz of raizes) {
      if (!raiz) continue;
      const messageId =
        this.textoDe(raiz, ['messageid', 'messageId', 'id']) ??
        this.textoDe(this.objetoDe(raiz, 'key'), ['id']);
      const bruto = this.textoDe(raiz, ['status', 'ack', 'messageStatus']);
      if (!messageId || !bruto) continue;
      const status = this.normalizarStatus(bruto);
      if (status) return { messageId, status };
    }
    return null;
  }

  /**
   * A uazapi usa `Delivered`/`Read` no schema de Message; Baileys e outros
   * provedores usam números (2 = entregue, 3 = lido). Aceita os dois e recusa o
   * resto — inclusive "sent", que não é promoção sobre o que já gravamos.
   */
  private normalizarStatus(bruto: string): StatusAck | null {
    const v = bruto.trim().toLowerCase();
    if (v === 'delivered' || v === 'delivery_ack' || v === '2') return 'delivered';
    if (v === 'read' || v === 'played' || v === '3' || v === '4') return 'read';
    return null;
  }

  private objetoDe(o: unknown, chave: string): Record<string, unknown> | null {
    if (!o || typeof o !== 'object') return null;
    const v = (o as Record<string, unknown>)[chave];
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  }

  private textoDe(o: unknown, chaves: string[]): string | null {
    if (!o || typeof o !== 'object') return null;
    const r = o as Record<string, unknown>;
    for (const k of chaves) {
      const v = r[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number') return String(v);
    }
    return null;
  }

  /** Só os nomes das chaves — nunca os valores, que trazem dado de cliente. */
  private formaDe(corpo: unknown): string {
    if (!corpo || typeof corpo !== 'object') return typeof corpo;
    return Object.keys(corpo as Record<string, unknown>).slice(0, 12).join(',');
  }
}
