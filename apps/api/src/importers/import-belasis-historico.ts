/**
 * Importa o HISTÓRICO do export Belasis para o tenant Fátima Cabelos:
 * comandas (Order + itens), pacotes (CustomerPackage + itens) e financeiro
 * (contas/formas/categorias + Transactions). Idempotente via legacyId.
 * Rodar: [DATABASE_URL=<rds>] pnpm --filter @beautypass/api exec tsx src/importers/import-belasis-historico.ts
 */
import { readFileSync } from 'fs';
import { prisma, Prisma } from '@beautypass/db';

const COMPANY_NAME = 'Fátima Cabelos';
const SRC = '/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/28e42bb6-13c1-4650-be86-5d19d8e94df4/scratchpad/belasis-data';
const norm = (s: string) => (s || '').trim().toUpperCase();
const load = (f: string) => JSON.parse(readFileSync(`${SRC}/${f}`, 'utf8')) as any[];
const D = (n: number) => new Prisma.Decimal(n || 0);

async function main() {
  const target = process.env.DATABASE_URL?.includes('amazonaws.com') ? 'PRODUÇÃO (RDS)' : 'LOCAL';
  const company = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (!company) throw new Error(`Empresa "${COMPANY_NAME}" não encontrada`);
  const companyId = company.id;
  console.log(`\n=== Import histórico Belasis → ${target} (company ${companyId}) ===`);

  // Mapas
  const custMap = new Map<string, string>();
  for (const c of await prisma.customer.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true } }))
    if (!custMap.has(norm(c.name))) custMap.set(norm(c.name), c.id);
  const profMap = new Map<string, string>();
  for (const p of await prisma.professional.findMany({ where: { companyId }, select: { id: true, name: true } }))
    if (!profMap.has(norm(p.name))) profMap.set(norm(p.name), p.id);
  const svcMap = new Map<string, { id: string; price: Prisma.Decimal }>();
  for (const s of await prisma.service.findMany({ where: { companyId }, select: { id: true, name: true, price: true } }))
    if (!svcMap.has(norm(s.name))) svcMap.set(norm(s.name), s);
  const prodMap = new Map<string, { id: string; salePrice: Prisma.Decimal }>();
  for (const p of await prisma.product.findMany({ where: { companyId }, select: { id: true, name: true, salePrice: true } }))
    if (!prodMap.has(norm(p.name))) prodMap.set(norm(p.name), p);

  // ---- FINANCEIRO: contas / formas / categorias ----
  const fin = load('financeiro.json');
  const accMap = new Map<string, string>();
  for (const name of [...new Set(fin.map((f) => f.conta).filter(Boolean))]) {
    const ex = await prisma.financialAccount.findFirst({ where: { companyId, name } });
    accMap.set(norm(name), (ex ?? (await prisma.financialAccount.create({ data: { companyId, name, type: /banc|itau|nubank|banco/i.test(name) ? 'bank' : 'cash' } }))).id);
  }
  const pmMap = new Map<string, string>();
  for (const name of [...new Set(fin.map((f) => f.forma).filter(Boolean))]) {
    const ex = await prisma.paymentMethod.findFirst({ where: { companyId, name } });
    pmMap.set(norm(name), (ex ?? (await prisma.paymentMethod.create({ data: { companyId, name } }))).id);
  }
  const catMap = new Map<string, string>();
  for (const f of fin) {
    if (!f.categoria || catMap.has(norm(f.categoria))) continue;
    const ex = await prisma.financialCategory.findFirst({ where: { companyId, name: f.categoria } });
    catMap.set(norm(f.categoria), (ex ?? (await prisma.financialCategory.create({ data: { companyId, name: f.categoria, kind: f.kind === 'expense' ? 'debit' : 'credit', isExpense: f.kind === 'expense' } }))).id);
  }
  console.log(`Financeiro: contas ${accMap.size}, formas ${pmMap.size}, categorias ${catMap.size}`);

  // ---- Transactions ----
  let txN = 0, txSkip = 0;
  for (let i = 0; i < fin.length; i++) {
    const f = fin[i];
    const legacyId = `tx:${f.kind}:${i}:${f.competencia || ''}:${Math.round((f.valor || 0) * 100)}`;
    if (await prisma.transaction.findFirst({ where: { companyId, legacyId }, select: { id: true } })) { txSkip++; continue; }
    const paid = (f.pago || 0) >= (f.valor || 0) && (f.valor || 0) > 0;
    await prisma.transaction.create({
      data: {
        companyId, kind: f.kind, grossAmount: D(f.valor), description: f.historico,
        accountId: f.conta ? accMap.get(norm(f.conta)) : undefined,
        paymentMethodId: f.forma ? pmMap.get(norm(f.forma)) : undefined,
        categoryId: f.categoria ? catMap.get(norm(f.categoria)) : undefined,
        partyType: f.kind === 'income' ? 'customer' : 'supplier',
        dueDate: f.vencimento ? new Date(f.vencimento) : null,
        paidAt: f.baixa && paid ? new Date(f.baixa) : null,
        status: paid ? 'paid' : 'pending', legacyId, legacySource: 'belasis-xls',
      },
    });
    txN++;
  }
  console.log(`Transações: ${txN} criadas, ${txSkip} puladas`);

  // ---- COMANDAS (Order + itens) ----
  const comandas = load('comandas.json');
  const itensAll = load('comanda-itens.json');
  const itemsByNum = new Map<number, any[]>();
  for (const it of itensAll) { if (!itemsByNum.has(it.num)) itemsByNum.set(it.num, []); itemsByNum.get(it.num)!.push(it); }
  let ordN = 0, ordSkip = 0, itmN = 0;
  for (const c of comandas) {
    const legacyId = `cmd:${c.num}`;
    if (await prisma.order.findFirst({ where: { companyId, legacyId }, select: { id: true } })) { ordSkip++; continue; }
    const its = (itemsByNum.get(c.num) || []).map((it) => {
      const svc = svcMap.get(norm(it.item)); const prd = svc ? null : prodMap.get(norm(it.item));
      if (!svc && !prd) return null;
      const unit = it.qtd ? (it.total || 0) / it.qtd : it.total || 0;
      return { kind: (svc ? 'service' : 'product') as any, refId: (svc ?? prd)!.id,
        professionalId: it.prof ? profMap.get(norm(it.prof)) ?? null : null,
        quantity: D(it.qtd || 1), unitPrice: D(unit), grossValue: D(it.total) };
    }).filter(Boolean) as any[];
    try {
      await prisma.order.create({
        data: {
          companyId, number: c.num, customerId: c.cliente ? custMap.get(norm(c.cliente)) ?? null : null,
          status: 'finished', grossTotal: D(c.subtotal), discountTotal: D(c.desconto),
          creditUsed: D(c.credito), cashbackUsed: D(c.cashback), netTotal: D(c.total),
          date: c.date ? new Date(c.date) : new Date(), legacyId, legacySource: 'belasis-xls',
          ...(its.length ? { items: { create: its } } : {}),
        },
      });
      ordN++; itmN += its.length;
    } catch (e: any) { if (!/Unique constraint/i.test(e.message)) throw e; ordSkip++; }
  }
  console.log(`Comandas: ${ordN} criadas (${itmN} itens), ${ordSkip} puladas`);

  // ---- PACOTES ----
  const pacotes = load('pacotes.json');
  let pkN = 0, pkSkip = 0;
  for (const p of pacotes) {
    const num = parseInt(String(p.code).replace(/\D/g, '')) || 0;
    const legacyId = `pkg:${p.code}`;
    if (await prisma.customerPackage.findFirst({ where: { companyId, legacyId }, select: { id: true } })) { pkSkip++; continue; }
    const customerId = custMap.get(norm(p.cliente));
    if (!customerId) { pkSkip++; continue; }
    const svc = svcMap.get(norm((p.itens || '').split(/[,+]/)[0].trim()));
    await prisma.customerPackage.create({
      data: {
        companyId, customerId, number: num, price: D(p.valor), status: p.status,
        expiresAt: p.validade ? new Date(p.validade) : null, legacyId, legacySource: 'belasis-xls',
        ...(svc ? { items: { create: [{ serviceId: svc.id, sessionsTotal: Math.round(p.qtd || 1), sessionsUsed: Math.max(0, Math.round((p.qtd || 1) - (p.saldo || 0))) }] } } : {}),
      },
    });
    pkN++;
  }
  console.log(`Pacotes: ${pkN} criados, ${pkSkip} pulados`);

  const totals = {
    comandas: await prisma.order.count({ where: { companyId } }),
    transacoes: await prisma.transaction.count({ where: { companyId } }),
    pacotes: await prisma.customerPackage.count({ where: { companyId } }),
  };
  console.log('Totais no tenant:', totals);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
