/** Certifica a progressão honesta da fila externa para os ACKs da Voltr. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VoltrForwarderService } from '../voltr/voltr-forwarder.service';

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
