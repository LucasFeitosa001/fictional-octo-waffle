/**
 * Backfill idempotente dos pagamentos de comandas importadas do Belasis.
 * Uso: DATABASE_URL=<RDS> COMPANY_NAME="Fátima Cabelos" tsx .../backfill...
 * SOURCE_FINANCEIRO aponta para o JSON extraído de Recebimentos.xls.
 */
import { readFileSync } from 'node:fs';
import { prisma, Prisma } from '@beautypass/db';

const companyName = process.env.COMPANY_NAME ?? 'Fátima Cabelos';
const source = process.env.SOURCE_FINANCEIRO ?? '/tmp/belasis-backfill/financeiro.json';
const norm = (s: string) => String(s ?? '').trim().toUpperCase();
const D = (n: number) => new Prisma.Decimal(Number(n) || 0);

function mainDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const company = await prisma.company.findFirstOrThrow({ where: { name: companyName } });
  const rows = JSON.parse(readFileSync(source, 'utf8')) as Array<Record<string, unknown>>;
  const methods = new Map<string, string>();
  for (const m of await prisma.paymentMethod.findMany({ where: { companyId: company.id } })) {
    methods.set(norm(m.name), m.id);
  }
  const accounts = new Map<string, string>();
  for (const a of await prisma.financialAccount.findMany({ where: { companyId: company.id } })) {
    accounts.set(norm(a.name), a.id);
  }
  const byOrder = new Map<number, typeof rows>();
  for (const row of rows) {
    const match = String(row.historico ?? '').match(/comanda\s*#\s*(\d+)/i);
    const amount = Number(row.pago ?? row.valor) || 0;
    if (!match || amount <= 0) continue;
    const number = Number(match[1]);
    const list = byOrder.get(number) ?? [];
    list.push(row);
    byOrder.set(number, list);
  }
  const orders = await prisma.order.findMany({
    where: { companyId: company.id, legacySource: 'belasis-xls', legacyId: { startsWith: 'cmd:' } },
    select: { id: true, number: true, payments: { select: { id: true } } },
  });
  let created = 0;
  let skipped = 0;
  const pending: Array<{
    orderId: string; paymentMethodId: string | null; accountId: string | null;
    amount: Prisma.Decimal; dueDate: Date | null; paidAt: Date | null;
    status: 'paid'; description: string;
  }> = [];
  for (const order of orders) {
    if (order.payments.length) { skipped++; continue; }
    const sourceRows = byOrder.get(order.number) ?? [];
    if (!sourceRows.length) continue;
    pending.push(...sourceRows.map((row) => ({
        orderId: order.id,
        paymentMethodId: row.forma ? methods.get(norm(String(row.forma))) ?? null : null,
        accountId: row.conta ? accounts.get(norm(String(row.conta))) ?? null : null,
        amount: D(Number(row.pago ?? row.valor) || 0),
        dueDate: mainDate(row.vencimento),
        paidAt: mainDate(row.baixa),
        status: 'paid' as const,
        description: row.forma ? `Importado do Belasis · ${row.forma}` : 'Importado do Belasis',
      })));
  }
  // Uma única chamada por lote evita milhares de round-trips ao RDS.
  for (let i = 0; i < pending.length; i += 500) {
    await prisma.orderPayment.createMany({ data: pending.slice(i, i + 500) });
    created += Math.min(500, pending.length - i);
  }
  const grouped = await prisma.orderPayment.groupBy({
    by: ['paymentMethodId'],
    _sum: { amount: true },
    where: { order: { companyId: company.id, legacySource: 'belasis-xls' }, status: 'paid' },
  });
  console.log(JSON.stringify({ company: company.name, orders: orders.length, created, skipped, byMethod: grouped }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
