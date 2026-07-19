/**
 * Importa os AGENDAMENTOS do export Belasis para o tenant Fátima Cabelos.
 * Idempotente via legacyId. Cria direto via prisma (sem validação de overlap/expediente).
 * Rodar (local): pnpm --filter @beautypass/api exec tsx src/importers/import-belasis-agendamentos.ts
 * Rodar (prod):  DATABASE_URL="<rds>" pnpm --filter @beautypass/api exec tsx src/importers/import-belasis-agendamentos.ts
 */
import { readFileSync } from 'fs';
import { prisma, Prisma } from '@beautypass/db';

const COMPANY_NAME = 'Fátima Cabelos';
const SRC = '/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/28e42bb6-13c1-4650-be86-5d19d8e94df4/scratchpad/belasis-data';
const norm = (s: string) => (s || '').trim().toUpperCase();

async function main() {
  const target = process.env.DATABASE_URL?.includes('amazonaws.com') ? 'PRODUÇÃO (RDS)' : 'LOCAL';
  const company = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (!company) throw new Error(`Empresa "${COMPANY_NAME}" não encontrada`);
  const companyId = company.id;
  console.log(`\n=== Import agendamentos Belasis → ${target} (company ${companyId}) ===`);

  const rows = JSON.parse(readFileSync(`${SRC}/agendamentos.json`, 'utf8')) as any[];

  // Mapas nome->id (uma vez)
  const custMap = new Map<string, string>();
  for (const c of await prisma.customer.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true } }))
    if (!custMap.has(norm(c.name))) custMap.set(norm(c.name), c.id);
  const profMap = new Map<string, string>();
  for (const p of await prisma.professional.findMany({ where: { companyId }, select: { id: true, name: true } }))
    if (!profMap.has(norm(p.name))) profMap.set(norm(p.name), p.id);
  const svcMap = new Map<string, { id: string; price: Prisma.Decimal; durationMin: number }>();
  for (const s of await prisma.service.findMany({ where: { companyId }, select: { id: true, name: true, price: true, durationMin: true } }))
    if (!svcMap.has(norm(s.name))) svcMap.set(norm(s.name), s);

  let created = 0, skipped = 0, noCustomer = 0, withItem = 0;
  for (const a of rows) {
    const legacyId = `apt:${a.start}:${norm(a.cliente)}:${norm(a.profissional || '')}`;
    const exists = await prisma.appointment.findFirst({ where: { companyId, legacyId }, select: { id: true } });
    if (exists) { skipped++; continue; }

    const customerId = custMap.get(norm(a.cliente)) ?? null;
    const professionalId = a.profissional ? profMap.get(norm(a.profissional)) ?? null : null;
    if (!customerId) noCustomer++;
    const start = new Date(a.start);
    const end = new Date(start.getTime() + (a.durMin || 60) * 60000);
    const svc = a.servico ? svcMap.get(norm(a.servico)) : undefined;

    await prisma.appointment.create({
      data: {
        companyId, customerId, professionalId, start, end,
        status: a.status, notes: a.notes || null, source: 'admin',
        legacyId, legacySource: 'belasis-xls',
        ...(svc
          ? { items: { create: [{ serviceId: svc.id, professionalId, durationMin: svc.durationMin, price: svc.price }] } }
          : {}),
      },
    });
    created++;
    if (svc) withItem++;
  }

  const total = await prisma.appointment.count({ where: { companyId } });
  const jul = await prisma.appointment.count({ where: { companyId, start: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } } });
  console.log(`Criados: ${created} · pulados(já existiam): ${skipped} · com serviço vinculado: ${withItem} · sem cliente casado: ${noCustomer}`);
  console.log(`Total de agendamentos no tenant: ${total} · em julho/2026: ${jul}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
