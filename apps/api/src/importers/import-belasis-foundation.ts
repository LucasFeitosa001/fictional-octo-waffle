/**
 * Importa a FUNDAÇÃO do export Belasis (cadastros) para o tenant Fátima Cabelos:
 * categorias, marcas, profissionais, serviços, produtos (com estoque) e clientes.
 * Idempotente via legacyId (@@unique([companyId, legacyId])). Re-rodar não duplica.
 *
 * Dados (JSON já convertido do .xls): scratchpad/belasis-data/*.json
 * Rodar (local):  pnpm --filter @beautypass/api exec tsx src/importers/import-belasis-foundation.ts
 * Rodar (prod):   DATABASE_URL="<rds>" pnpm --filter @beautypass/api exec tsx src/importers/import-belasis-foundation.ts
 */
import { readFileSync } from 'fs';
import { prisma } from '@beautypass/db';

const COMPANY_NAME = 'Fátima Cabelos';
const SRC = '/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/28e42bb6-13c1-4650-be86-5d19d8e94df4/scratchpad/belasis-data';
const SRC_TAG = 'belasis-xls';
const load = (f: string) => JSON.parse(readFileSync(`${SRC}/${f}`, 'utf8'));
const norm = (s: string) => s.trim().toUpperCase();

async function main() {
  const target = process.env.DATABASE_URL?.includes('amazonaws.com') ? 'PRODUÇÃO (RDS)' : 'LOCAL';
  const company = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (!company) throw new Error(`Empresa "${COMPANY_NAME}" não encontrada`);
  const companyId = company.id;
  console.log(`\n=== Import fundação Belasis → ${target} (company ${companyId}) ===`);

  const clientes = load('clientes.json') as any[];
  const itens = load('itens.json') as any[];
  const estoque = new Map<string, any>((load('estoque.json') as any[]).map((e) => [norm(e.name), e]));
  const estMin = new Map<string, number>((load('estoque-min.json') as any[]).map((e) => [norm(e.name), e.minStock]));
  const profs = load('profissionais.json') as string[];

  // ---- Categorias de Produto compartilhadas por serviços/produtos e Marcas ----
  const svcCatNames = [...new Set(itens.filter((i) => i.kind === 'service' && i.category).map((i) => i.category as string))];
  const prodCatNames = [...new Set(itens.filter((i) => i.kind === 'product' && i.category).map((i) => i.category as string))];
  const brandNames = [...new Set(itens.filter((i) => i.brand).map((i) => i.brand as string))];
  const svcCat = new Map<string, string>();
  for (const name of svcCatNames) {
    const found = await prisma.productCategory.findFirst({ where: { companyId, name } });
    const row = found ?? (await prisma.productCategory.create({ data: { companyId, name } }));
    svcCat.set(norm(name), row.id);
  }
  const prodCat = new Map<string, string>();
  for (const name of prodCatNames) {
    const found = await prisma.productCategory.findFirst({ where: { companyId, name } });
    const row = found ?? (await prisma.productCategory.create({ data: { companyId, name } }));
    prodCat.set(norm(name), row.id);
  }
  const brands = new Map<string, string>();
  for (const name of brandNames) {
    const found = await prisma.brand.findFirst({ where: { companyId, name } });
    const row = found ?? (await prisma.brand.create({ data: { companyId, name } }));
    brands.set(norm(name), row.id);
  }
  console.log(`Categorias compartilhadas de serviço: ${svcCat.size} · categorias de produto: ${prodCat.size} · marcas: ${brands.size}`);

  // ---- Profissionais ----
  let profN = 0;
  for (const name of profs) {
    const legacyId = `prof:${norm(name)}`;
    const existing = await prisma.professional.findFirst({ where: { companyId, OR: [{ legacyId }, { name }] } });
    if (existing) {
      if (!existing.legacyId) await prisma.professional.update({ where: { id: existing.id }, data: { legacyId, legacySource: SRC_TAG } });
    } else {
      await prisma.professional.create({ data: { companyId, name, legacyId, legacySource: SRC_TAG } });
      profN++;
    }
  }
  console.log(`Profissionais novos: ${profN} (total no arquivo: ${profs.length})`);

  // ---- Serviços e Produtos ----
  let svcN = 0, prodN = 0;
  for (const it of itens) {
    if (it.kind === 'service') {
      const legacyId = `svc:${norm(it.name)}`;
      const data: any = {
        name: it.name, price: it.price ?? 0, durationMin: it.durationMin || 30,
        cashbackPercent: 0, categoryId: it.category ? svcCat.get(norm(it.category)) : undefined,
        legacyId, legacySource: SRC_TAG,
      };
      const ex = await prisma.service.findFirst({ where: { companyId, OR: [{ legacyId }, { name: it.name }] } });
      if (ex) await prisma.service.update({ where: { id: ex.id }, data: { ...data, legacyId: ex.legacyId ?? legacyId } });
      else { await prisma.service.create({ data: { ...data, companyId } }); svcN++; }
    } else {
      const legacyId = `prod:${norm(it.name)}`;
      const est = estoque.get(norm(it.name));
      const data: any = {
        name: it.name, salePrice: it.price ?? 0, costPrice: est?.cost ?? 0,
        stock: est?.stock ?? 0, minStock: estMin.get(norm(it.name)) ?? 0,
        defaultCommissionPercent: it.commission ?? 0, unit: it.unit || null,
        categoryId: it.category ? prodCat.get(norm(it.category)) : undefined,
        brandId: it.brand ? brands.get(norm(it.brand)) : undefined,
        legacyId, legacySource: SRC_TAG,
      };
      const ex = await prisma.product.findFirst({ where: { companyId, OR: [{ legacyId }, { name: it.name }] } });
      if (ex) await prisma.product.update({ where: { id: ex.id }, data: { ...data, legacyId: ex.legacyId ?? legacyId } });
      else { await prisma.product.create({ data: { ...data, companyId } }); prodN++; }
    }
  }
  console.log(`Serviços novos: ${svcN} · produtos novos: ${prodN}`);

  // ---- Clientes (dedup dos 22 parciais por nome) ----
  let cliNew = 0, cliUpd = 0;
  for (const c of clientes) {
    const legacyId = `cli:${norm(c.name)}|${c.mobile || ''}`;
    const data: any = {
      name: c.name, phone: c.mobile || c.phone || null, secondaryPhone: c.phone && c.mobile ? c.phone : null,
      email: c.email || null, cpf: c.cpf || null, rg: c.rg || null,
      birthday: c.birthday ? new Date(c.birthday) : null, active: c.active !== false,
      legacyId, legacySource: SRC_TAG,
    };
    const ex = await prisma.customer.findFirst({ where: { companyId, deletedAt: null, OR: [{ legacyId }, { name: c.name }] } });
    if (ex) {
      await prisma.customer.update({ where: { id: ex.id }, data: { ...data, legacyId: ex.legacyId ?? legacyId } });
      cliUpd++;
    } else { await prisma.customer.create({ data: { ...data, companyId } }); cliNew++; }
  }
  console.log(`Clientes: ${cliNew} novos, ${cliUpd} atualizados/mesclados`);

  const totals = {
    clientes: await prisma.customer.count({ where: { companyId, deletedAt: null } }),
    servicos: await prisma.service.count({ where: { companyId } }),
    produtos: await prisma.product.count({ where: { companyId } }),
    profissionais: await prisma.professional.count({ where: { companyId } }),
    categoriasServico: await prisma.serviceCategory.count({ where: { companyId } }),
    categoriasProduto: await prisma.productCategory.count({ where: { companyId } }),
    marcas: await prisma.brand.count({ where: { companyId } }),
  };
  console.log('Totais no tenant:', totals);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
