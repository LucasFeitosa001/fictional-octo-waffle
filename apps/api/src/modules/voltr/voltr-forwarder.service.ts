import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  WhatsappService,
  type WhatsappDeliveryUpdate,
} from '../whatsapp/whatsapp.service';
import { VoltrService, type VoltrStatusEntrega } from './voltr.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Encaminha para a Voltr cada mensagem que o WhatsApp do salão recebe
 * (estudo 68) e, depois, o recibo de entrega dela (estudo 79).
 *
 * ENTRA COMO CONSUMIDOR ADICIONAL: `addInboundHandler` e `addDeliveryHandler`
 * acrescentam ouvintes ao conjunto, sem substituir o handler do fluxo de
 * agendamento nem o do inbox. E é fire-and-forget: erro aqui vira log, nunca
 * derruba o atendimento — a Voltr é integração, não caminho crítico.
 *
 * NADA AQUI ENVIA MENSAGEM. Este serviço só LÊ o que o WhatsApp já entregou
 * (a mensagem no `messages.upsert`, o ACK no `messages.update`) e copia para o
 * inbox da Voltr. As travas de automação de envio não passam por aqui.
 */

/** Degrau de cada ACK. Só sobe: um recibo antigo que chega atrasado nunca pode
 *  fazer o ✓✓ azul voltar a ser um ✓ no chat da Voltr. */
const DEGRAU_ACK: Record<WhatsappDeliveryUpdate['status'], number> = {
  sent: 1,
  delivered: 2,
  read: 3,
};

/** ACK do WhatsApp → vocabulário do `/api/ingest/status` da Voltr.
 *  ('falha' existe lá, mas o Baileys não nos dá esse sinal por este canal.) */
const STATUS_VOLTR: Record<
  WhatsappDeliveryUpdate['status'],
  VoltrStatusEntrega
> = {
  sent: 'enviada',
  delivered: 'entregue',
  read: 'lida',
};

/** Espera antes de despachar os recibos acumulados. Junta o enxame
 *  entregue→lida do mesmo envio numa só chamada e dá tempo da cópia da mensagem
 *  chegar na Voltr antes do status dela. */
const ACK_JANELA_MS = 2_000;

/** Nova tentativa quando a Voltr ainda não conhece aquele externalId. */
const ACK_RETENTATIVA_MS = 10_000;

/** Tentativas por recibo antes de desistir em silêncio. */
const ACK_MAX_TENTATIVAS = 3;

/** Teto de chamadas por rodada — o `/api/ingest/status` aceita 240/min. */
const ACK_MAX_POR_RODADA = 60;

/** Pausa depois de uma rodada cheia. 60 chamadas a cada 15s = exatamente os
 *  240/min que o endpoint aceita, mesmo quando um backlog inteiro dá ACK junto. */
const ACK_PAUSA_RODADA_MS = 15_000;

/** Quantas mensagens encaminhadas ficam na memória esperando o ACK. */
const ENCAMINHADAS_MAX = 5_000;

/** ACK que chega depois disso não interessa mais (e a memória não é eterna). */
const ENCAMINHADAS_TTL_MS = 12 * 60 * 60 * 1000;

/** Uma mensagem nossa que já foi copiada para a Voltr e pode receber recibo. */
interface MensagemEncaminhada {
  /** Maior degrau que a Voltr JÁ tem gravado. Começa em `sent` porque lá a
   *  mensagem nasce com `statusEntrega = 'enviada'` — esse degrau já está pago. */
  degrau: number;
  em: number;
}

/** Recibo esperando a janela fechar para ser despachado. */
interface ReciboPendente {
  companyId: string;
  externalId: string;
  degrau: number;
  status: VoltrStatusEntrega;
  tentativas: number;
  /** Momento a partir do qual pode sair (janela de coalescência ou retentativa). */
  em: number;
}

@Injectable()
export class VoltrForwarderService implements OnModuleInit, OnModuleDestroy {
  /**
   * Último telefone conhecido de cada chat (`remoteJid` → dígitos).
   *
   * Só a ENTRADA traz o telefone em conversa @lid; a saída vem sem. Guardar o
   * que a entrada resolveu é o que mantém os dois lados na mesma conversa.
   * Memória do processo: se reiniciar antes de qualquer entrada daquele chat, a
   * saída fica sem chave e é descartada — melhor perder uma linha do que
   * espalhar a conversa em duas.
   */
  private readonly telefonePorChat = new Map<string, string>();

  private readonly logger = new Logger(VoltrForwarderService.name);
  private cancelarInbound: (() => void) | null = null;
  private cancelarAck: (() => void) | null = null;

  /** `companyId|whatsappMessageId` → o que a Voltr já sabe daquela mensagem.
   *  A chave carrega o companyId de propósito: recibo de um salão não pode
   *  encostar na conversa de outro. */
  private readonly encaminhadas = new Map<string, MensagemEncaminhada>();
  private readonly pendentes = new Map<string, ReciboPendente>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Quando o timer atual vai disparar — para um recibo mais urgente conseguir
   *  adiantar a rodada em vez de esperar a retentativa de outro. */
  private timerEm = 0;
  private despachando = false;
  private parado = false;

  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly voltr: VoltrService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.cancelarInbound = this.whatsapp.addInboundHandler((msg) => {
      // Os dois sentidos vão. Antes o que o salão mandava era descartado aqui, e
      // o inbox da Voltr ficava com meia conversa — só a fala do cliente, que foi
      // o que o dono viu. Ver estudo 78.
      const texto = msg.text?.trim();
      if (!texto) return;

      // Só o que o SALÃO manda ganha recibo, e só se a ponte estiver ligada.
      // Guardamos antes do POST: o ACK costuma vir depois, e quem chegar antes
      // da cópia existir lá é reagendado pelo despacho.
      if (msg.fromMe && msg.messageId && this.voltr.integracaoLigada(msg.companyId)) {
        this.lembrarEncaminhada(msg.companyId, msg.messageId);
      }

      // A conversa é identificada pelo CONTATO, e o contato é o `remoteJid` — em
      // conversa 1:1 ele é sempre o outro lado, venha a mensagem de quem vier.
      // Usar `fromDigits` quebrava nas conversas @lid: para mensagem MINHA o
      // telefone vem vazio (whatsappParticipantIdentity só resolve o PN quando
      // !fromMe), e a Voltr abria uma conversa nova com a chave "@s.whatsapp.net"
      // — um chat fantasma só com o que o salão mandou.
      // Em conversa @lid o WhatsApp entrega o telefone só na ENTRADA: medido na
      // produção do dono, 31 mensagens de entrada com telefone e 42 de saída
      // SEM. Por isso a entrada caía na conversa certa e a saída abria um chat
      // fantasma com a chave vazia "@s.whatsapp.net".
      //
      // A saída herda o telefone que a entrada daquele mesmo chat já resolveu.
      // Usar o próprio @lid como chave também uniria os dois lados, mas numa
      // TERCEIRA conversa — as que já existem estão gravadas pelo telefone.
      if (msg.remoteJid && msg.fromDigits) {
        this.telefonePorChat.set(msg.remoteJid, msg.fromDigits);
      }
      void this.encaminhar(msg, texto);
    });

    // ✓ enviada, ✓✓ entregue, ✓✓ azul lida — o mesmo que o salão vê no celular.
    // O handler é síncrono de propósito (o WhatsappService espera cada ouvinte):
    // aqui só anota; quem fala com a rede é o despacho, fora do caminho do ACK.
    this.cancelarAck = this.whatsapp.addDeliveryHandler((ack) => {
      this.registrarAck(ack);
    });
  }

  /** Resolve o contato e encaminha. Separado porque a busca do telefone é async. */
  private async encaminhar(
    msg: { companyId: string; remoteJid?: string; fromDigits: string; fromMe: boolean; messageId?: string; pushName?: string },
    texto: string,
  ): Promise<void> {
    try {
      const digitos =
        msg.fromDigits || (await this.telefoneDoChat(msg.companyId, msg.remoteJid));
      const jidDoContato = digitos
        ? `${digitos}@s.whatsapp.net`
        : msg.remoteJid?.endsWith('@s.whatsapp.net')
          ? msg.remoteJid
          : null;
      // Sem saber de quem é a conversa, não se inventa uma.
      if (!jidDoContato) return;

      void this.voltr
        .encaminharInbound({
          companyId: msg.companyId,
          contatoJid: jidDoContato,
          text: texto,
          externalId: msg.messageId,
          nomeCliente: msg.pushName,
          doSalao: msg.fromMe,
        })
        .catch((err: Error) => {
          this.logger.warn(
            `Não deu para encaminhar a mensagem para a Voltr: ${err.message}`,
          );
        });
    } catch (err) {
      this.logger.warn(
        `Não deu para resolver o contato da mensagem: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Telefone do contato daquele chat, quando a mensagem não traz.
   *
   * Em conversa @lid o WhatsApp só entrega o telefone na ENTRADA — medido na
   * produção: 31 entradas com telefone, 42 saídas sem. `WhatsappConversation`
   * guarda o par remoteJid→phone de forma durável, então a saída acha o contato
   * mesmo depois de um deploy (o cache em memória nasce vazio e por isso não
   * bastava). O cache continua, mas só como atalho: quem manda é a tabela.
   */
  private async telefoneDoChat(
    companyId: string,
    remoteJid?: string,
  ): Promise<string> {
    if (!remoteJid) return '';
    const emCache = this.telefonePorChat.get(remoteJid);
    if (emCache) return emCache;
    const conversa = await this.prisma.client.whatsappConversation.findFirst({
      where: { companyId, remoteJid },
      select: { phone: true },
    });
    const digitos = (conversa?.phone ?? '').replace(/\D/g, '');
    if (digitos) this.telefonePorChat.set(remoteJid, digitos);
    return digitos;
  }

  onModuleDestroy(): void {
    this.parado = true;
    this.cancelarInbound?.();
    this.cancelarInbound = null;
    this.cancelarAck?.();
    this.cancelarAck = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timerEm = 0;
    this.pendentes.clear();
    this.encaminhadas.clear();
  }

  /** Anota que esta mensagem nossa foi copiada para a Voltr e pode receber ACK. */
  private lembrarEncaminhada(companyId: string, messageId: string): void {
    this.encaminhadas.set(this.chave(companyId, messageId), {
      degrau: DEGRAU_ACK.sent,
      em: Date.now(),
    });
    this.podarEncaminhadas();
  }

  /**
   * Recebe o ACK do Baileys e decide se a Voltr precisa saber.
   *
   * Sai calado em três casos, todos normais: status que não sobe o degrau,
   * mensagem que nunca foi para a Voltr (mídia, outro salão, envio anterior a um
   * restart) e degrau que a Voltr já tem.
   */
  private registrarAck(ack: WhatsappDeliveryUpdate): void {
    if (this.parado) return;
    const degrau = DEGRAU_ACK[ack.status];
    if (!degrau) return;

    const chave = this.chave(ack.companyId, ack.whatsappMessageId);
    const encaminhada = this.encaminhadas.get(chave);
    if (!encaminhada) return; // não está no inbox da Voltr — nada a atualizar
    if (degrau <= encaminhada.degrau) return; // 'enviada' já é o estado inicial lá

    const pendente = this.pendentes.get(chave);
    if (pendente) {
      // Já tem despacho agendado: só promove o degrau (entregue → lida) para
      // sair UMA chamada com o estado mais novo.
      if (degrau > pendente.degrau) {
        pendente.degrau = degrau;
        pendente.status = STATUS_VOLTR[ack.status];
      }
      return;
    }

    this.pendentes.set(chave, {
      companyId: ack.companyId,
      externalId: ack.whatsappMessageId,
      degrau,
      status: STATUS_VOLTR[ack.status],
      tentativas: 0,
      em: Date.now() + ACK_JANELA_MS,
    });
    this.agendarDespacho(ACK_JANELA_MS);
  }

  private agendarDespacho(atrasoMs: number): void {
    if (this.parado || this.despachando) return;
    const atraso = Math.max(250, atrasoMs);
    const alvo = Date.now() + atraso;
    // Já existe rodada marcada para antes disso — ela resolve.
    if (this.timer && this.timerEm <= alvo) return;
    if (this.timer) clearTimeout(this.timer);
    this.timerEm = alvo;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.despachar();
    }, atraso);
    // Um recibo pendente não pode segurar o processo no shutdown.
    this.timer.unref?.();
  }

  /** Manda para a Voltr os recibos cuja janela já fechou. Um por vez, com teto
   *  por rodada: o endpoint de lá tem rate-limit e isto é pano de fundo. */
  private async despachar(): Promise<void> {
    if (this.parado || this.despachando) return;
    this.despachando = true;
    try {
      const agora = Date.now();
      const vencidos = [...this.pendentes.entries()].filter(([, p]) => p.em <= agora);
      const prontos = vencidos.slice(0, ACK_MAX_POR_RODADA);

      // Rodada cheia: o que sobrou espera a próxima janela em vez de voltar em
      // 250ms e estourar o rate-limit da Voltr.
      for (const [, sobra] of vencidos.slice(ACK_MAX_POR_RODADA)) {
        sobra.em = agora + ACK_PAUSA_RODADA_MS;
      }

      for (const [chave, pendente] of prontos) {
        if (this.parado) return;
        // Tira da fila antes de ir para a rede; se um ACK melhor chegar durante
        // a chamada, ele volta a entrar como pendente novo e é despachado depois.
        this.pendentes.delete(chave);
        await this.despacharUm(chave, pendente);
      }
    } catch (err) {
      // Rede/Voltr fora não podem derrubar o processo do salão.
      this.logger.warn(
        `Falha ao despachar recibos para a Voltr: ${(err as Error).message}`,
      );
    } finally {
      this.despachando = false;
      this.reagendar();
    }
  }

  private async despacharUm(chave: string, pendente: ReciboPendente): Promise<void> {
    const resultado = await this.voltr
      .enviarStatus(pendente.companyId, pendente.externalId, pendente.status)
      .catch((err: Error) => {
        this.logger.warn(
          `Recibo ${pendente.status} não chegou na Voltr: ${err.message}`,
        );
        return { ok: false, motivo: 'sem_resposta' as const };
      });

    if (resultado.ok) {
      const encaminhada = this.encaminhadas.get(chave);
      if (encaminhada && pendente.degrau > encaminhada.degrau) {
        encaminhada.degrau = pendente.degrau;
      }
      return;
    }

    // Desligada ou recusada não melhora repetindo. 'mensagem_nao_encontrada' e
    // 'sem_resposta', sim: normalmente é o ACK correndo na frente da cópia da
    // mensagem, ou a Voltr piscando.
    const repetivel =
      resultado.motivo === 'mensagem_nao_encontrada' ||
      resultado.motivo === 'sem_resposta';
    if (!repetivel || pendente.tentativas + 1 >= ACK_MAX_TENTATIVAS) return;

    const novo: ReciboPendente = {
      ...pendente,
      tentativas: pendente.tentativas + 1,
      em: Date.now() + ACK_RETENTATIVA_MS,
    };
    // Se um ACK mais novo entrou na fila enquanto isto rodava, ele manda.
    const atual = this.pendentes.get(chave);
    if (atual) {
      if (atual.degrau < novo.degrau) {
        atual.degrau = novo.degrau;
        atual.status = novo.status;
      }
      return;
    }
    this.pendentes.set(chave, novo);
  }

  /** Reagenda a próxima rodada para o recibo pendente mais próximo de vencer. */
  private reagendar(): void {
    if (this.parado || !this.pendentes.size) return;
    let proximo = Number.POSITIVE_INFINITY;
    for (const pendente of this.pendentes.values()) {
      if (pendente.em < proximo) proximo = pendente.em;
    }
    this.agendarDespacho(proximo - Date.now());
  }

  /** Mantém a memória curta: sai o mais velho quando estoura o teto ou o prazo. */
  private podarEncaminhadas(): void {
    const vencidoAntesDe = Date.now() - ENCAMINHADAS_TTL_MS;
    for (const [chave, item] of this.encaminhadas) {
      // Map itera na ordem de inserção: o primeiro que sobrevive encerra a poda.
      if (this.encaminhadas.size <= ENCAMINHADAS_MAX && item.em > vencidoAntesDe) {
        break;
      }
      this.encaminhadas.delete(chave);
    }
  }

  private chave(companyId: string, messageId: string): string {
    return `${companyId}|${messageId}`;
  }
}
