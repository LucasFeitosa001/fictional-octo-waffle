import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@beautypass/db';
import { CampaignsService } from '../campaigns/campaigns.service';
import { CustomersService } from '../customers/customers.service';
import { MarketingService } from '../marketing/marketing.service';

function customersService(client: any) {
  client.$executeRaw ??= async () => 1;
  client.$transaction ??= async (run: (tx: any) => unknown) => run(client);
  return new CustomersService({ client } as any);
}

describe('UC-04 — saldo utilizável do cliente', () => {
  it('consulta cashback com filtro de validade', async () => {
    let cashbackWhere: any;
    const service = customersService({
      customer: {
        findFirst: async () => ({ id: 'customer-1', companyId: 'company-a' }),
      },
      customerCredit: {
        aggregate: async () => ({ _sum: { amount: new Prisma.Decimal(25) } }),
      },
      customerCashback: {
        findMany: async ({ where }: any) => {
          cashbackWhere = where;
          return [{ amount: new Prisma.Decimal(40) }];
        },
      },
    });

    const balance = await service.balance('company-a', 'customer-1');

    assert.equal(balance.creditBalance, 25);
    assert.equal(balance.cashbackBalance, 40);
    assert.ok(Array.isArray(cashbackWhere.OR));
    assert.ok(cashbackWhere.OR.some((condition: any) => condition.expiresAt?.gte instanceof Date));
  });

  it('rejeita resgate maior que o saldo válido', async () => {
    const service = customersService({
      customer: {
        findFirst: async () => ({ id: 'customer-1', companyId: 'company-a' }),
      },
      company: {
        findUnique: async () => ({ cashbackCanRedeem: true }),
      },
      customerCashback: {
        findMany: async () => [{ amount: new Prisma.Decimal(5) }],
      },
    });

    await assert.rejects(
      service.redeemCashback('company-a', 'customer-1', { amount: 10 }),
      /Saldo de cashback insuficiente/,
    );
  });
});

describe('GAP: UC-CRM-005/008 — consistência do cashback exibido', () => {
  it('não soma lançamentos expirados no saldo do extrato', async () => {
    const service = customersService({
      customer: {
        findFirst: async () => ({ id: 'customer-1', companyId: 'company-a' }),
      },
      customerCashback: {
        findMany: async () => [
          {
            amount: new Prisma.Decimal(100),
            expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          },
          {
            amount: new Prisma.Decimal(50),
            expiresAt: new Date('2020-01-01T00:00:00.000Z'),
          },
        ],
      },
    });

    const result = await service.listCashback('company-a', 'customer-1');

    assert.equal(result.saldo, 100, 'o saldo exibido deve coincidir com o saldo resgatável');
  });

  it('rejeita ajuste negativo que deixaria o ledger abaixo de zero', async () => {
    let created = false;
    const service = customersService({
      customer: {
        findFirst: async () => ({ id: 'customer-1', companyId: 'company-a' }),
      },
      customerCashback: {
        create: async () => {
          created = true;
          return { id: 'cashback-1' };
        },
        findMany: async () => [{ amount: new Prisma.Decimal(10) }],
      },
    });

    await assert.rejects(
      service.adjustCashback('company-a', 'customer-1', { amount: -20 }),
      /saldo de cashback insuficiente/i,
    );
    assert.equal(created, false);
  });
});

describe('GAP: UC-CRM-011/013 — privacidade e trilha do cliente', () => {
  it('não mistura WhatsappOutbox de outro tenant na timeline', async () => {
    const service = customersService({
      customer: {
        findFirst: async () => ({
          id: 'customer-1',
          companyId: 'company-a',
          phone: '+55 85 99999-1234',
        }),
      },
      whatsappOutbox: {
        // O banco devolveria esta linha porque o where atual casa somente a cauda
        // do telefone. Ela representa outra empresa usando o mesmo número.
        findMany: async () => [
          {
            id: 'foreign-message',
            companyId: 'company-b',
            customerId: 'other-customer',
            toPhone: '5585999991234',
            text: 'Mensagem privada do salão B',
            status: 'sent',
            kind: 'manual',
            sentAt: new Date('2026-07-01T12:00:00.000Z'),
            createdAt: new Date('2026-07-01T11:59:00.000Z'),
          },
        ],
      },
      campaignMessage: {
        findMany: async () => [],
      },
    });

    const result = await service.listInteractions('company-a', 'customer-1');

    assert.deepEqual(result.data, [], 'nenhuma mensagem de company-b pode aparecer em company-a');
  });

  it('impede alterar respostas ou remover assinatura de anamnese já assinada', async () => {
    let updated = false;
    const service = customersService({
      customer: {
        findFirst: async () => ({ id: 'customer-1', companyId: 'company-a' }),
      },
      customerAnamnesis: {
        findFirst: async () => ({
          id: 'anamnesis-1',
          customerId: 'customer-1',
          signedAt: new Date('2026-07-01T12:00:00.000Z'),
        }),
        update: async () => {
          updated = true;
          return { id: 'anamnesis-1' };
        },
      },
    });

    await assert.rejects(
      service.updateAnamnesis('company-a', 'customer-1', 'anamnesis-1', {
        answersJson: { alergia: 'resposta alterada' },
        signedAt: null,
      }),
      /assinada|imutável|auditoria/i,
    );
    assert.equal(updated, false);
  });
});

describe('GAP: UC-CRM-014/028 — marketing coerente', () => {
  it('prévia withPhone considera opt-out, não apenas presença do telefone', async () => {
    const service = new CampaignsService(
      { client: {} } as any,
      undefined as any,
      undefined as any,
    );
    (service as any).resolveSegment = async () => [
      {
        id: 'customer-1',
        name: 'Aceitou',
        phone: '5585999991111',
        notificationsEnabled: true,
        whatsappOptIn: true,
      },
      {
        id: 'customer-2',
        name: 'Recusou',
        phone: '5585999992222',
        notificationsEnabled: true,
        whatsappOptIn: false,
      },
      {
        id: 'customer-3',
        name: 'Sem telefone',
        phone: null,
        notificationsEnabled: true,
        whatsappOptIn: true,
      },
    ];

    const preview = await service.previewSegment('company-a', { kind: 'all' });

    assert.equal(preview.count, 3);
    assert.equal(preview.withPhone, 1, 'somente destinatários realmente enviáveis devem ser contados');
  });

  it('rejeita promoção cuja data final antecede a inicial', async () => {
    let created = false;
    const service = new MarketingService({
      client: {
        promotion: {
          create: async () => {
            created = true;
            return { id: 'promotion-1' };
          },
        },
      },
    } as any);

    await assert.rejects(
      service.createPromotion('company-a', {
        name: 'Período inválido',
        scopeType: 'all',
        discountType: 'percent',
        discountValue: 10,
        validFrom: '2026-08-10',
        validTo: '2026-08-01',
      }),
      /data|período|validade/i,
    );
    assert.equal(created, false);
  });
});
