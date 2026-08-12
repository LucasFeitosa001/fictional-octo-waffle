import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@beautypass/db';
import { CashRegistersService } from '../cash-registers/cash-registers.module';
import { MembershipsService } from '../memberships/memberships.service';
import { OrdersService } from '../orders/orders.service';

function ordersService(client: any) {
  return new OrdersService({ client } as any, { enqueueFollowUp: async () => undefined } as any);
}

describe('UC-02 — regressões de comanda já corrigidas', () => {
  it('mantém unitPrice=0 como cortesia em vez de usar o catálogo', async () => {
    const service = ordersService({
      service: {
        findFirst: async () => ({ price: new Prisma.Decimal(90) }),
      },
    });

    const price = await (service as any).resolveUnitPrice('company-a', {
      kind: 'service',
      refId: 'svc-1',
      unitPrice: 0,
    });

    assert.equal(price.toNumber(), 0);
  });

  it('PATCH genérico rejeita troca de status que pularia a reconciliação', async () => {
    let updated = false;
    const service = ordersService({
      order: {
        findFirst: async () => ({ id: 'order-1', status: 'open' }),
        update: async () => {
          updated = true;
        },
      },
    });

    await assert.rejects(
      service.update('company-a', 'order-1', { status: 'finished' }),
      /Status da comanda não muda por aqui/,
    );
    assert.equal(updated, false);
  });

  it('não estorna isoladamente pagamento de comanda finalizada', async () => {
    const service = ordersService({
      order: {
        findFirst: async () => ({ id: 'order-1', status: 'finished' }),
      },
      orderPayment: {
        findFirst: async () => ({ id: 'payment-1' }),
        update: async () => ({ id: 'payment-1', status: 'reversed' }),
      },
    });

    await assert.rejects(
      service.reversePayment('company-a', 'order-1', 'payment-1'),
      /reabra a comanda/i,
    );
  });

  it('rejeita desconto percentual acima de 100%', async () => {
    const service = ordersService({
      order: {
        findFirst: async () => ({
          id: 'order-1',
          status: 'open',
          grossTotal: new Prisma.Decimal(100),
        }),
      },
    });

    await assert.rejects(
      service.addDiscount('company-a', 'order-1', {
        type: 'percent',
        value: 101,
      }),
      /não pode passar de 100%/,
    );
  });
});

describe('UC-CMD-014..017 — caixa', () => {
  it('calcula saldo como abertura + entradas - saídas', () => {
    const service = new CashRegistersService({ client: {} } as any);
    const summary = (service as any).summarize({
      openingBalance: 100,
      movements: [
        {
          type: 'in',
          amount: 80,
          refType: 'payment',
          paymentMethod: { name: 'Dinheiro' },
        },
        {
          type: 'out',
          amount: 20,
          refType: 'sangria',
          paymentMethod: null,
        },
        {
          type: 'in',
          amount: 10,
          refType: 'suprimento',
          paymentMethod: null,
        },
      ],
    });

    assert.equal(summary.saldoEmCaixa, 170);
    assert.equal(summary.dinheiro, 80);
    assert.equal(summary.sangrias, 20);
    assert.equal(summary.suprimentos, 10);
  });
});

describe('GAP: UC-CMD-016..017 — integridade do caixa', () => {
  it('rejeita forma de pagamento de outro tenant em movimento manual', async () => {
    let movementCreated = false;
    const tx = {
      $queryRaw: async () => [],
      cashRegister: {
        findFirst: async () => ({
          id: 'cash-1',
          status: 'open',
          responsibleUserId: 'user-1',
        }),
      },
      paymentMethod: {
        findFirst: async () => null,
      },
      cashMovement: {
        create: async () => {
          movementCreated = true;
          return { id: 'movement-1' };
        },
      },
    };
    const service = new CashRegistersService({
      client: { $transaction: async (fn: any) => fn(tx) },
    } as any);

    await assert.rejects(
      service.addMovement(
        'company-a',
        'cash-1',
        {
          type: 'in',
          amount: 10,
          paymentMethodId: 'method-from-company-b',
        },
        'user-1',
        false,
      ),
      /forma de pagamento|método de pagamento/i,
    );
    assert.equal(movementCreated, false);
  });

  it('persiste a anotação informada no fechamento do caixa', async () => {
    let updateData: any;
    const tx = {
      $queryRaw: async () => [],
      cashRegister: {
        findFirst: async () => ({
          id: 'cash-1',
          status: 'open',
          responsibleUserId: 'user-1',
          openingBalance: 100,
          openedAt: new Date('2026-01-01T09:00:00.000Z'),
          movements: [],
        }),
        update: async ({ data }: any) => {
          updateData = data;
          return { id: 'cash-1', ...data };
        },
      },
    };
    const service = new CashRegistersService({
      client: { $transaction: async (fn: any) => fn(tx) },
    } as any);

    await service.close(
      'company-a',
      'cash-1',
      { countedBalance: 100, note: 'Fechamento conferido por Maria' },
      'user-1',
      false,
    );

    assert.equal(
      updateData.note,
      'Fechamento conferido por Maria',
      'o DTO aceita note, então a informação não pode ser descartada',
    );
  });
});

describe('GAP: UC-CMD-028 — benefício de assinatura em comanda', () => {
  it('expõe uma operação de consumo com saldo por ciclo e estorno', () => {
    const service = new MembershipsService({ client: {} } as any);

    assert.equal(
      typeof (service as any).consumeBenefit,
      'function',
      'o módulo precisa de uma operação auditável de consumo de benefício',
    );
  });
});
