import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@beautypass/db';
import { CommissionsService } from '../commissions/commissions.service';
import { OrdersService } from '../orders/orders.service';
import { PurchasesService } from '../purchases/purchases.service';

// O SalonPayService entrou como dependência (pagar com SalonPay emite uma
// transferência). Nestes testes de unidade ele é um duble: o que está sob teste
// é a fórmula da comissão, não o repasse.
const salonpayDuble = {
  registrarTransferencia: async () => null,
} as any;

function commissionService(tx: any) {
  return new CommissionsService(
    { client: { $transaction: async (fn: any) => fn(tx) } } as any,
    salonpayDuble,
  );
}

function orderService() {
  return new OrdersService(
    { client: {} } as any,
    { enqueueFollowUp: async () => undefined } as any,
  );
}

function paymentTx(input: {
  entries?: any[];
  advances?: any[];
  onEntryWhere?: (where: any) => void;
  onAdvanceUpdate?: () => void;
  /** Vale consumido em PARTE: recebe o valor debitado e o saldo recriado. */
  onAdvanceSplit?: (consumido: unknown, residual: unknown) => void;
}) {
  return {
    commissionEntry: {
      findMany: async ({ where }: any) => {
        input.onEntryWhere?.(where);
        return input.entries ?? [];
      },
      updateMany: async () => ({ count: input.entries?.length ?? 0 }),
    },
    commissionAdvance: {
      findMany: async () => input.advances ?? [],
      updateMany: async () => {
        input.onAdvanceUpdate?.();
        return { count: input.advances?.length ?? 0 };
      },
      // O pagamento parcial de vale usa estes três: lê o original, reduz a
      // linha ao que foi debitado e cria o saldo restante em aberto.
      findUnique: async () => ({
        professionalId: 'pro-1',
        date: new Date('2026-07-01T00:00:00.000Z'),
        note: null,
      }),
      update: async ({ data }: any) => {
        input.onAdvanceSplit?.(data.amount, undefined);
        return { id: 'advance-1', ...data };
      },
      create: async ({ data }: any) => {
        input.onAdvanceSplit?.(undefined, data.amount);
        return { id: 'advance-saldo', ...data };
      },
    },
    commissionPayment: {
      create: async ({ data }: any) => ({ id: 'payment-1', ...data }),
      update: async ({ data }: any) => ({ id: 'payment-1', ...data }),
    },
    professional: {
      findFirst: async () => ({ name: 'Pro Um' }),
    },
    financialCategory: {
      findFirst: async () => null,
    },
    transaction: {
      create: async ({ data }: any) => ({ id: 'tx-1', ...data }),
    },
    paymentMethod: {
      findFirst: async () => null,
    },
    cashRegister: {
      findFirst: async () => null,
    },
    cashMovement: {
      create: async ({ data }: any) => ({ id: 'cm-1', ...data }),
    },
  };
}

describe('UC-03 — cálculos financeiros que já funcionam', () => {
  it('limita o total negativo de uma linha de compra a zero', () => {
    const service = new PurchasesService({ client: {} } as any);
    const total = (service as any).lineTotal({
      productId: 'product-1',
      quantity: 2,
      unitCost: 10,
      discount: 25,
    });

    assert.equal(total.toNumber(), 0);
  });

  it('calcula pagamento como comissão + bônus - vales', async () => {
    const tx = paymentTx({
      entries: [
        {
          id: 'entry-1',
          commissionAmount: new Prisma.Decimal(100),
          bonusAmount: new Prisma.Decimal(10),
        },
      ],
      advances: [{ id: 'advance-1', amount: new Prisma.Decimal(30) }],
    });
    const service = commissionService(tx);

    const payment = await service.createPayment('company-a', {
      professionalId: 'pro-1',
    });

    assert.equal(Number(payment.amount), 80);
    assert.equal(Number(payment.commissionTotal), 100);
    assert.equal(Number(payment.bonusTotal), 10);
    assert.equal(Number(payment.advancesTotal), 30);
  });
});

describe('GAP: UC-FIN-017 — total completo da compra', () => {
  it('inclui outras despesas e subtrai outras receitas', () => {
    const service = new PurchasesService({ client: {} } as any);
    const total = (service as any).computeTotal(
      [{ productId: 'product-1', quantity: 2, unitCost: 50 }],
      10,
      5,
      7,
      3,
    );

    assert.equal(
      total.toNumber(),
      109,
      '2×50 + frete 10 - desconto 5 + despesas 7 - receitas 3',
    );
  });
});

describe('GAP: UC-FIN-020/022 — geração de comissão', () => {
  it('usa a regra global quando não existe regra específica do profissional', async () => {
    const created: any[] = [];
    const tx = {
      commissionEntry: {
        findFirst: async () => null,
        create: async ({ data }: any) => {
          created.push(data);
          return data;
        },
      },
      professionalCommissionRule: {
        findMany: async () => [],
      },
      commissionRule: {
        findFirst: async () => ({
          scopeType: 'all',
          type: 'percent',
          value: new Prisma.Decimal(10),
        }),
      },
      service: {
        findUnique: async ({ select }: any) =>
          select.categoryId
            ? { categoryId: null }
            : { defaultCommissionPercent: new Prisma.Decimal(0) },
      },
      product: {
        findUnique: async () => null,
      },
    };

    await (orderService() as any).generateCommissionEntries(tx, 'company-a', {
      id: 'order-1',
      date: new Date('2026-07-01T12:00:00.000Z'),
      items: [
        {
          kind: 'service',
          refId: 'svc-1',
          professionalId: 'pro-1',
          grossValue: new Prisma.Decimal(100),
          discount: new Prisma.Decimal(0),
          professional: { id: 'pro-1', receivesCommission: true },
        },
      ],
    });

    assert.equal(created.length, 1);
    assert.equal(Number(created[0].commissionAmount), 10);
  });

  it('gera a parcela do auxiliar cadastrado no item', async () => {
    const created: any[] = [];
    const tx = {
      commissionEntry: {
        findFirst: async () => null,
        create: async ({ data }: any) => {
          created.push(data);
          return data;
        },
      },
      professionalCommissionRule: {
        findMany: async () => [
          {
            scopeType: 'all',
            scopeId: null,
            type: 'percent',
            value: new Prisma.Decimal(20),
          },
        ],
      },
      service: {
        findUnique: async () => ({ categoryId: null }),
      },
      product: {
        findUnique: async () => ({ categoryId: null }),
      },
    };

    await (orderService() as any).generateCommissionEntries(tx, 'company-a', {
      id: 'order-1',
      date: new Date('2026-07-01T12:00:00.000Z'),
      items: [
        {
          kind: 'service',
          refId: 'svc-1',
          professionalId: 'pro-main',
          grossValue: new Prisma.Decimal(100),
          discount: new Prisma.Decimal(0),
          professional: { id: 'pro-main', receivesCommission: true },
          auxiliaries: [
            {
              professionalId: 'pro-aux',
              discountFrom: 'professional',
              valueType: 'percent',
              value: new Prisma.Decimal(25),
            },
          ],
        },
      ],
    });

    assert.ok(
      created.some((entry) => entry.professionalId === 'pro-aux'),
      'o auxiliar precisa receber uma CommissionEntry auditável',
    );
  });
});

describe('GAP: UC-FIN-024/026 — quitação segura de comissões', () => {
  it('seleciona apenas entradas cuja availableDate já venceu', async () => {
    let entryWhere: any;
    const service = commissionService(
      paymentTx({
        onEntryWhere: (where) => {
          entryWhere = where;
        },
      }),
    );

    await service.createPayment('company-a', { professionalId: 'pro-1' });

    assert.ok(
      entryWhere.availableDate?.lte instanceof Date,
      'comissão futura não pode entrar no pagamento atual',
    );
  });

  it('rejeita pagamento para profissional de outro tenant', async () => {
    const tx = {
      ...paymentTx({}),
      professional: {
        findFirst: async () => null,
      },
    };
    const service = commissionService(tx);

    await assert.rejects(
      service.createPayment('company-a', {
        professionalId: 'professional-from-company-b',
      }),
      /profissional/i,
    );
  });

  it('não consome integralmente vale maior que comissão disponível', async () => {
    let advanceUpdated = false;
    let debitado: unknown;
    let saldo: unknown;
    const tx = paymentTx({
      entries: [
        {
          id: 'entry-1',
          commissionAmount: new Prisma.Decimal(50),
          bonusAmount: new Prisma.Decimal(0),
        },
      ],
      advances: [{ id: 'advance-1', amount: new Prisma.Decimal(100) }],
      onAdvanceUpdate: () => {
        advanceUpdated = true;
      },
      onAdvanceSplit: (consumido, residual) => {
        if (consumido !== undefined) debitado = consumido;
        if (residual !== undefined) saldo = residual;
      },
    });
    const service = commissionService(tx);

    const pagamento = await service.createPayment('company-a', {
      professionalId: 'pro-1',
      advanceIds: ['advance-1'],
    });

    assert.equal(
      advanceUpdated,
      false,
      'quitar o vale inteiro (updateMany) apagaria os R$ 50 que continuam devidos',
    );
    assert.equal(Number(debitado), 50, 'só os R$ 50 que cabiam podem ser debitados');
    assert.equal(Number(saldo), 50, 'os R$ 50 restantes viram saldo em aberto');
    assert.equal(
      Number((pagamento as any).advancesTotal),
      50,
      'o pagamento registra o que foi RECUPERADO, não o valor cheio do vale',
    );
  });

  it('não permite marcar entry como paid sem criar CommissionPayment', async () => {
    let updated = false;
    const service = new CommissionsService(
      {
        client: {
          commissionEntry: {
            findFirst: async () => ({ id: 'entry-1', status: 'open' }),
            update: async () => {
              updated = true;
              return { id: 'entry-1', status: 'paid' };
            },
          },
        },
      } as any,
      salonpayDuble,
    );

    await assert.rejects(
      service.updateEntry('company-a', 'entry-1', { status: 'paid' }),
      /pagamento|quitação/i,
    );
    assert.equal(updated, false);
  });
});

describe('GAP: UC-FIN-028 — período de comissão', () => {
  it('expõe operação de abertura e fechamento de período', () => {
    const service = new CommissionsService({ client: {} } as any, salonpayDuble);

    assert.equal(typeof (service as any).openClosingPeriod, 'function');
    assert.equal(typeof (service as any).closeClosingPeriod, 'function');
  });
});
