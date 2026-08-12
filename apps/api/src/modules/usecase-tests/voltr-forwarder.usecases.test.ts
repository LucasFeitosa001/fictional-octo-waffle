/** Certifica a progressão honesta da fila externa para os ACKs da Voltr. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VoltrForwarderService } from '../voltr/voltr-forwarder.service';
import {
  WhatsappService,
  type WhatsappDeliveryUpdate,
  type WhatsappInbound,
} from '../whatsapp/whatsapp.service';
import type { VoltrService } from '../voltr/voltr.service';

describe('Status da ponte Voltr (estudo 91)', () => {
  function servico() {
    return new VoltrForwarderService(
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('mensagem copiada começa antes do ACK sent; sent promove para enviada', () => {
    const service = servico();
    const interno = service as unknown as {
      lembrarEncaminhada(companyId: string, messageId: string): void;
      registrarAck(update: {
        companyId: string;
        whatsappMessageId: string;
        status: 'sent' | 'delivered' | 'read';
        at: Date;
      }): void;
      encaminhadas: Map<string, { degrau: number }>;
      pendentes: Map<string, { degrau: number; status: string }>;
      chave(companyId: string, messageId: string): string;
    };

    interno.lembrarEncaminhada('empresa-1', 'wa-1');
    const chave = interno.chave('empresa-1', 'wa-1');
    assert.equal(interno.encaminhadas.get(chave)?.degrau, 0);

    interno.registrarAck({
      companyId: 'empresa-1',
      whatsappMessageId: 'wa-1',
      status: 'sent',
      at: new Date(),
    });
    assert.deepEqual(
      {
        degrau: interno.pendentes.get(chave)?.degrau,
        status: interno.pendentes.get(chave)?.status,
      },
      { degrau: 1, status: 'enviada' },
    );
    service.onModuleDestroy();
  });

  it('ACK atrasado nunca regride entregue/lida para enviada', () => {
    const service = servico();
    const interno = service as unknown as {
      lembrarEncaminhada(companyId: string, messageId: string): void;
      registrarAck(update: {
        companyId: string;
        whatsappMessageId: string;
        status: 'sent' | 'delivered' | 'read';
        at: Date;
      }): void;
      pendentes: Map<string, { degrau: number; status: string }>;
      chave(companyId: string, messageId: string): string;
    };
    interno.lembrarEncaminhada('empresa-1', 'wa-2');
    const chave = interno.chave('empresa-1', 'wa-2');
    interno.registrarAck({
      companyId: 'empresa-1',
      whatsappMessageId: 'wa-2',
      status: 'read',
      at: new Date(),
    });
    interno.registrarAck({
      companyId: 'empresa-1',
      whatsappMessageId: 'wa-2',
      status: 'sent',
      at: new Date(),
    });
    assert.equal(interno.pendentes.get(chave)?.status, 'lida');
    assert.equal(interno.pendentes.get(chave)?.degrau, 3);
    service.onModuleDestroy();
  });
});

/**
 * O relógio eterno no inbox da Voltr (estudo 100).
 *
 * O que a Voltr manda enviar nasce LÁ com um UUID dela, que chega até nós em
 * `requestKey`; o WhatsApp devolve o ACK com um id completamente outro. Enquanto
 * o recibo saía com o id do WhatsApp, o `/api/ingest/status` não achava aquela
 * Mensagem e ela ficava presa em `na_fila` — relógio para sempre no balão.
 *
 * O que estes testes travam:
 *  - o recibo de uma mensagem NASCIDA NA VOLTR sai com o UUID dela;
 *  - o recibo de uma mensagem DIGITADA PELO SALÃO continua saindo com o id do
 *    WhatsApp — foi assim que a cópia dela foi criada lá, e é o caminho que já
 *    funciona hoje;
 *  - o conserto do eco (estudo 98) continua de pé: o que nasceu na Voltr NÃO
 *    volta para o inbox dela como mensagem nova;
 *  - a escada continua monotônica depois da tradução.
 */
describe('Recibo da Voltr casa pela chave que a Voltr conhece (estudo 100)', () => {
  interface ChamadaDeStatus {
    companyId: string;
    externalId: string;
    status: string;
  }

  interface Bancada {
    service: VoltrForwarderService;
    /** Simula a chegada da mensagem `fromMe` no stream do Baileys. */
    entrar(msg: Partial<WhatsappInbound> & { messageId: string }): Promise<void>;
    /** Simula o ACK do WhatsApp. */
    ack(messageId: string, status: WhatsappDeliveryUpdate['status']): void;
    /** Despacha agora o recibo pendente, sem esperar a janela de coalescência. */
    despachar(messageId: string): Promise<void>;
    /** Cópias que subiram para o inbox da Voltr (`/api/ingest/mensagem`). */
    copiadas: string[];
    /** Recibos que chegaram no `/api/ingest/status`. */
    recibos: ChamadaDeStatus[];
  }

  /**
   * @param nascidasNaVoltr `id do WhatsApp` → `externalId da Voltr`. Quem não
   * está no mapa é mensagem digitada pelo atendente no celular do salão.
   */
  function bancada(nascidasNaVoltr: Record<string, string>): Bancada {
    const copiadas: string[] = [];
    const recibos: ChamadaDeStatus[] = [];
    let inbound: ((msg: WhatsappInbound) => void) | null = null;
    let entrega: ((ack: WhatsappDeliveryUpdate) => void) | null = null;

    const whatsapp = {
      addInboundHandler(fn: (msg: WhatsappInbound) => void) {
        inbound = fn;
        return () => undefined;
      },
      addDeliveryHandler(fn: (ack: WhatsappDeliveryUpdate) => void) {
        entrega = fn;
        return () => undefined;
      },
      nasceuNaVoltr: (id: string) =>
        Object.prototype.hasOwnProperty.call(nascidasNaVoltr, id),
      externalIdDaVoltr: (id: string): string | undefined => nascidasNaVoltr[id],
    } as unknown as WhatsappService;

    const voltr = {
      integracaoLigada: () => true,
      encaminharInbound: (msg: { externalId?: string }) => {
        copiadas.push(msg.externalId ?? '');
        return Promise.resolve();
      },
      enviarStatus: (companyId: string, externalId: string, status: string) => {
        recibos.push({ companyId, externalId, status });
        return Promise.resolve({ ok: true });
      },
    } as unknown as VoltrService;

    const service = new VoltrForwarderService(whatsapp, voltr, {} as never);
    service.onModuleInit();

    const interno = service as unknown as {
      pendentes: Map<string, { externalId: string; status: string }>;
      chave(companyId: string, messageId: string): string;
      despacharUm(chave: string, pendente: unknown): Promise<void>;
    };

    return {
      service,
      copiadas,
      recibos,
      async entrar(msg) {
        inbound?.({
          fromDigits: '5511988887777',
          text: 'oi',
          remoteJid: '5511988887777@s.whatsapp.net',
          fromMe: true,
          timestamp: new Date(),
          companyId: 'empresa-1',
          ...msg,
        } as WhatsappInbound);
        // `encaminhar` é async: deixa o POST e o ACK `sent` assentarem.
        await new Promise((resolve) => setImmediate(resolve));
      },
      ack(messageId, status) {
        entrega?.({
          companyId: 'empresa-1',
          whatsappMessageId: messageId,
          status,
          at: new Date(),
        });
      },
      async despachar(messageId) {
        const chave = interno.chave('empresa-1', messageId);
        const pendente = interno.pendentes.get(chave);
        assert.ok(pendente, `nada pendente para ${messageId}`);
        interno.pendentes.delete(chave);
        await interno.despacharUm(chave, pendente);
      },
    };
  }

  it('o que a Voltr mandou enviar recebe o recibo com o UUID DELA, não com o id do WhatsApp', async () => {
    const b = bancada({ 'wa-voltr-1': 'edbfc94b-56b6-435f-b456-000000000001' });

    await b.entrar({ messageId: 'wa-voltr-1' });
    // Estudo 98: a cópia já existe na Voltr — não sobe de novo.
    assert.deepEqual(b.copiadas, [], 'o eco da própria Voltr não vira mensagem nova');

    await b.despachar('wa-voltr-1');
    assert.deepEqual(b.recibos, [
      {
        companyId: 'empresa-1',
        externalId: 'edbfc94b-56b6-435f-b456-000000000001',
        status: 'enviada',
      },
    ]);

    b.ack('wa-voltr-1', 'read');
    await b.despachar('wa-voltr-1');
    assert.deepEqual(b.recibos[1], {
      companyId: 'empresa-1',
      externalId: 'edbfc94b-56b6-435f-b456-000000000001',
      status: 'lida',
    });

    b.service.onModuleDestroy();
  });

  it('mensagem digitada no celular do salão continua indo com o id do WhatsApp', async () => {
    const b = bancada({});

    await b.entrar({ messageId: '3EB0E11BB5C341037176C7' });
    // Esta não nasceu na Voltr: a cópia PRECISA subir, senão o inbox de lá fica
    // com meia conversa (estudo 78).
    assert.deepEqual(b.copiadas, ['3EB0E11BB5C341037176C7']);

    await b.despachar('3EB0E11BB5C341037176C7');
    assert.deepEqual(b.recibos, [
      {
        companyId: 'empresa-1',
        externalId: '3EB0E11BB5C341037176C7',
        status: 'enviada',
      },
    ]);

    b.service.onModuleDestroy();
  });

  it('a tradução não deixa a escada andar para trás', async () => {
    const b = bancada({ 'wa-voltr-2': 'uuid-da-voltr-2' });
    await b.entrar({ messageId: 'wa-voltr-2' });
    b.ack('wa-voltr-2', 'read');
    b.ack('wa-voltr-2', 'sent');

    await b.despachar('wa-voltr-2');
    assert.deepEqual(b.recibos.at(-1), {
      companyId: 'empresa-1',
      externalId: 'uuid-da-voltr-2',
      status: 'lida',
    });

    b.service.onModuleDestroy();
  });
});

/**
 * O par `id do WhatsApp → externalId da Voltr` é gravado no mesmo tique do
 * envio. É a única fonte da tradução: se ele sumir, o recibo volta a sair com o
 * id errado e o relógio volta.
 */
describe('Par id-do-WhatsApp ↔ externalId da Voltr (estudo 100)', () => {
  function whatsappService() {
    return new WhatsappService({} as never);
  }

  function interno(service: WhatsappService) {
    return service as unknown as {
      marcarNascidaNaVoltr(messageId: string, requestKey: string | null): void;
      nascidasNaVoltr: Map<string, string>;
    };
  }

  it('guarda o requestKey da Voltr e o devolve para o encaminhador', () => {
    const service = whatsappService();
    interno(service).marcarNascidaNaVoltr('wa-1', 'uuid-da-voltr');

    assert.equal(service.nasceuNaVoltr('wa-1'), true, 'a porta do eco continua fechando');
    assert.equal(service.externalIdDaVoltr('wa-1'), 'uuid-da-voltr');
  });

  it('mensagem que não nasceu na Voltr não tem tradução', () => {
    const service = whatsappService();
    assert.equal(service.nasceuNaVoltr('wa-do-salao'), false);
    assert.equal(service.externalIdDaVoltr('wa-do-salao'), undefined);
  });

  it('sem requestKey o par vira identidade — comportamento de antes, nunca undefined', () => {
    const service = whatsappService();
    interno(service).marcarNascidaNaVoltr('wa-2', null);

    assert.equal(service.nasceuNaVoltr('wa-2'), true);
    assert.equal(service.externalIdDaVoltr('wa-2'), 'wa-2');
  });

  it('o teto despeja pela CHAVE, não pelo valor — senão a memória cresceria sem fim', () => {
    const service = whatsappService();
    const dentro = interno(service);
    for (let i = 0; i < 520; i += 1) {
      dentro.marcarNascidaNaVoltr(`wa-${i}`, `uuid-${i}`);
    }
    assert.equal(dentro.nascidasNaVoltr.size, 500, 'o teto é respeitado de verdade');
    assert.equal(service.externalIdDaVoltr('wa-0'), undefined, 'o mais velho saiu');
    assert.equal(service.externalIdDaVoltr('wa-519'), 'uuid-519', 'o mais novo ficou');
  });
});
