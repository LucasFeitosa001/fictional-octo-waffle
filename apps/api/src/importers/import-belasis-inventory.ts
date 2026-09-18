/** Importa movimentos históricos de estoque e preserva clientes inativos.
 * O saldo atual já vem de Estoque-Completo; portanto os movimentos históricos
 * são gravados apenas como trilha, sem somar novamente ao estoque atual. */
import { readFileSync } from 'fs';
import { prisma } from '@beautypass/db';

const COMPANY_NAME = 'Fátima Cabelos';
const SRC = '/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/28e42bb6-13c1-4650-be86-5d19d8e94df4/scratchpad/belasis-data';
const load = (f: string) => JSON.parse(readFileSync(`${SRC}/${f}`, 'utf8')) as any[];
const norm = (s: string) => (s || '').trim().toUpperCase();

async function main() {
  const company = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (!company) throw new Error(`Empresa "${COMPANY_NAME}" não encontrada`);
  const products = new Map<string, string>();
  for (const p of await prisma.product.findMany({ where: { companyId: company.id }, select: { id: true, name: true } })) products.set(norm(p.name), p.id);

  let created = 0, skipped = 0, missing = 0;
  for (const m of load('movimentacoes-estoque.json')) {
    const productId = products.get(norm(m.product));
    if (!productId) { missing++; continue; }
    const exists = await prisma.inventoryMovement.findFirst({ where: { productId, refType: 'belasis-xls', refId: m.legacyId }, select: { id: true } });
    if (exists) { skipped++; continue; }
    await prisma.inventoryMovement.create({ data: {
      productId, type: m.type, quantity: m.quantity, reason: m.reason,
      refType: 'belasis-xls', refId: m.legacyId, createdAt: new Date(`${m.date}T12:00:00-03:00`),
    } });
    created++;
  }

  let inactive = 0, inactiveMissing = 0;
  for (const c of load('clientes-inativos.json')) {
    const found = await prisma.customer.findFirst({ where: { companyId: company.id, deletedAt: null, OR: [
      { name: c.name }, ...(c.phone ? [{ phone: c.phone }] : []),
    ] }, select: { id: true, active: true } });
    if (!found) { inactiveMissing++; continue; }
    if (found.active) { await prisma.customer.update({ where: { id: found.id }, data: { active: false } }); inactive++; }
  }
  console.log(`Movimentos de estoque: ${created} criados, ${skipped} já existentes, ${missing} sem produto correspondente.`);
  console.log(`Clientes marcados inativos: ${inactive}; não localizados: ${inactiveMissing}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
