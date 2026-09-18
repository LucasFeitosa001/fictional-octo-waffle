/** Completa itens de comandas importadas antes de itens históricos ausentes
 * serem recriados no catálogo. Só toca ordens Belasis sem nenhum item. */
import { readFileSync } from 'fs';
import { prisma, Prisma } from '@beautypass/db';
const SRC = '/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/28e42bb6-13c1-4650-be86-5d19d8e94df4/scratchpad/belasis-data';
const load = (f: string) => JSON.parse(readFileSync(`${SRC}/${f}`, 'utf8')) as any[];
const norm = (s: string) => (s || '').trim().toUpperCase();
const D = (n: number) => new Prisma.Decimal(n || 0);
async function main() {
  const company = await prisma.company.findFirst({ where: { name: 'Fátima Cabelos' } }); if (!company) throw new Error('Empresa não encontrada');
  const svc = new Map<string, { id: string }>(); for (const x of await prisma.service.findMany({ where: { companyId: company.id }, select: { id: true, name: true } })) svc.set(norm(x.name), x);
  const prod = new Map<string, { id: string }>(); for (const x of await prisma.product.findMany({ where: { companyId: company.id }, select: { id: true, name: true } })) prod.set(norm(x.name), x);
  const prof = new Map<string, string>(); for (const x of await prisma.professional.findMany({ where: { companyId: company.id }, select: { id: true, name: true } })) prof.set(norm(x.name), x.id);
  const byNum = new Map<number, any[]>(); for (const x of load('comanda-itens.json')) { const a = byNum.get(x.num) || []; a.push(x); byNum.set(x.num, a); }
  const orders = await prisma.order.findMany({ where: { companyId: company.id, legacySource: 'belasis-xls' }, include: { items: { select: { id: true } } } });
  let ordersN = 0, itemsN = 0, missing = 0;
  for (const o of orders) {
    if (o.items.length) continue; const rows = byNum.get(o.number) || []; const data: any[] = [];
    for (const x of rows) { const s = svc.get(norm(x.item)); const p = s ? null : prod.get(norm(x.item)); if (!s && !p) { missing++; continue; }
      data.push({ kind: s ? 'service' : 'product', refId: (s || p)!.id, professionalId: x.prof ? prof.get(norm(x.prof)) || null : null, quantity: D(x.qtd || 1), unitPrice: D(x.qtd ? (x.total || 0) / x.qtd : x.total || 0), grossValue: D(x.total || 0) }); }
    if (data.length) { await prisma.orderItem.createMany({ data: data.map((x) => ({ ...x, orderId: o.id })) }); ordersN++; itemsN += data.length; }
  }
  let consumedN = 0, consumedSkip = 0, consumedMissing = 0;
  const allOrders = await prisma.order.findMany({ where: { companyId: company.id, legacySource: 'belasis-xls' }, select: { id: true, number: true, items: { select: { id: true, kind: true } } } });
  for (const x of load('produtos-consumidos.json')) {
    const order = allOrders.find((o) => o.number === x.num); const product = prod.get(norm(x.product));
    if (!order || !product) { consumedMissing++; continue; }
    const serviceItem = order.items.find((i) => i.kind === 'service') || order.items[0]; if (!serviceItem) { consumedMissing++; continue; }
    const exists = await prisma.orderItemConsumedProduct.findFirst({ where: { orderItemId: serviceItem.id, productId: product.id } });
    if (exists) { consumedSkip++; continue; }
    await prisma.orderItemConsumedProduct.create({ data: { orderItemId: serviceItem.id, productId: product.id, quantity: D(x.quantity), unitValue: D(x.unitValue), unit: x.unit } }); consumedN++;
  }
  console.log(`Comandas completadas: ${ordersN}; itens criados: ${itemsN}; itens ainda sem cadastro: ${missing}.`);
  console.log(`Produtos consumidos: ${consumedN} criados, ${consumedSkip} já existentes, ${consumedMissing} sem vínculo.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
