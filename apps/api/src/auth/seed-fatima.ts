/**
 * Importação PARCIAL da base "Fátima Cabelos" (origem: Belasis) a partir dos
 * dados visíveis na planilha `mapeamento_migracao_belasis.xlsx` (aba
 * "Clientes Visíveis"). São apenas ~22 clientes extraídos de um vídeo — NÃO é o
 * export oficial. Quando o export completo chegar, dedup por telefone/nome.
 *
 * O que cria (idempotente — pode rodar de novo sem duplicar):
 *   - Tenant/empresa "Fátima Cabelos" + login administrador
 *   - Profissional "Fátima Lacerda"
 *   - Clientes (nome, telefone, aniversário)
 *   - Histórico de comandas/pacotes preservado como CustomerNote marcada "[BELASIS]"
 *     (Orders/Pacotes NÃO são criados aqui para não corromper o financeiro antes
 *      do export oficial; virão na carga completa.)
 *
 * Rodar (local):  pnpm --filter @beautypass/api exec tsx src/auth/seed-fatima.ts
 * Rodar (prod):   DATABASE_URL="<rds>" pnpm --filter @beautypass/api exec tsx src/auth/seed-fatima.ts
 */
import { prisma } from '@beautypass/db';
import { auth, ensureOwnerProfessional } from './better-auth';

const COMPANY_NAME = 'Fátima Cabelos';
const OWNER_EMAIL = 'contato@fatimacabelos.com.br';
const OWNER_PASSWORD = 'fatima@2026';
const OWNER_NAME = 'Fátima Cabelos';
const PROFESSIONAL_NAME = 'Fátima Lacerda';
const MARK = '[BELASIS]';

type Cust = {
  name: string;
  phone?: string; // dígitos DDD+número
  birthday?: string; // ISO
  note?: string; // histórico Belasis (comanda/pacote)
};

// Extraído da aba "Clientes Visíveis". Telefones normalizados para dígitos.
const CUSTOMERS: Cust[] = [
  { name: 'ADELIA ARAUJO', birthday: '1998-01-01', note: 'Perfil aberto no vídeo; aniversário 01/01/1998.' },
  { name: 'ADELINA', note: 'Cadastro de clientes; sem telefone visível.' },
  { name: 'ADRIANA BEZERRA', note: 'Cadastro de clientes; sem telefone visível.' },
  { name: 'ADRIANA GALDINO', phone: '89981228494', note: 'Comanda #3182 — R$ 135,00 — finalizada em 29/05/2026.' },
  { name: 'ADRIANA LOPES LEAL', note: 'Cadastro de clientes; sem telefone visível.' },
  { name: 'ADRIANA RODRIGUES', phone: '89999736982' },
  { name: 'ADRIANE BARBOSA', phone: '89999721356' },
  { name: 'ADRIELLE DE MOURA', note: 'Cadastro; telefone não legível no vídeo.' },
  { name: 'ADRIELLE DO CARMO SANTOS', note: 'Cadastro; nome/telefone parcialmente visível.' },
  { name: 'MARIA VALDANIA', phone: '89994257545', note: 'Comanda #3184 — R$ 450,00 — 29/05/2026 — Contorno de Mechas — pagamento dinheiro — prof. Fátima Lacerda.' },
  { name: 'MARY PINHEIRO', note: 'Comanda #3183 — R$ 250,00 — 29/05/2026 — pagamento Pix.' },
  { name: 'TEREZA NUNES', note: 'Comanda #3181 — R$ 120,00 — 29/05/2026 — pagamento dinheiro.' },
  { name: 'GABRIELA MOURA', note: 'Comanda #3180 — R$ 700,00 — 28/05/2026 — finalizada.' },
  { name: 'LARISSA SALÃO', note: 'Comanda #3179 — R$ 30,00 — 27/05/2026 — finalizada.' },
  { name: 'LUIZA NAFILA SILVA', note: 'Comanda #3178 — R$ 100,00 — 27/05/2026 — finalizada.' },
  { name: 'EDINALVA ARAUJO', note: 'Comanda #3177 — R$ 750,00 — finalizada.' },
  { name: 'ELAINE DOS SANTOS DO CARMO', note: 'Comanda #3176 — R$ 600,00 — finalizada (nome truncado na tela original).' },
  { name: 'BRUNA', phone: '89999387007', note: 'Pacote #9 — R$ 279,03 — 17/03/2026 — não expira — ativo — saldo 1.' },
  { name: 'MARIA IZADORA TEIXEIRA', note: 'Pacote #8 — R$ 400,00 — 17/11/2025 — expira 17/12/2025 — vencido.' },
  { name: 'KERLLEY GOMES', note: 'Pacote #7 — R$ 120,00 — 30/11/2024 — não expira — vencido. Pacote #6 — R$ 120,00 — 04/11/2024 — não expira — vencido.' },
  { name: 'PAULA SAMPAIO', note: 'Pacote #5 — R$ 450,00 — 11/10/2024 — não expira — vencido.' },
  { name: 'SOLANGE MORAES', note: 'Pacote #4 — R$ 350,00 — registro parcialmente visível.' },
];

async function ensureCompany(): Promise<string> {
  const existing = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (existing) {
    console.log(`Empresa "${COMPANY_NAME}" já existe (${existing.id}).`);
    return existing.id;
  }

  // Já existe o usuário owner (de uma execução anterior interrompida)?
  const existingUser = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { companyId: true },
  });
  if (existingUser?.companyId) {
    await prisma.company.update({ where: { id: existingUser.companyId }, data: { name: COMPANY_NAME } });
    console.log(`Empresa renomeada para "${COMPANY_NAME}" (${existingUser.companyId}).`);
    return existingUser.companyId;
  }

  // Cria via Better Auth (dispara o hook que provisiona a Company + Role Administrador).
  const res = await auth.api.signUpEmail({
    body: { name: OWNER_NAME, email: OWNER_EMAIL, password: OWNER_PASSWORD },
  });
  const created = await prisma.user.findUnique({
    where: { id: res.user.id },
    select: { companyId: true },
  });
  if (!created?.companyId) throw new Error('Hook de provisionamento não criou empresa.');
  await prisma.company.update({ where: { id: created.companyId }, data: { name: COMPANY_NAME } });
  console.log(`Empresa "${COMPANY_NAME}" criada (${created.companyId}); login ${OWNER_EMAIL} / ${OWNER_PASSWORD}.`);
  return created.companyId;
}

async function ensureProfessional(companyId: string) {
  // O owner do salão (contato@fatimacabelos.com.br) É a Fátima Lacerda. Quando a
  // empresa nasce via signUpEmail, o hook já cria um Professional vinculado ao dono
  // (nome "Proprietário(a)"). Aqui reaproveitamos esse Professional do dono como a
  // "Fátima Lacerda" — evita duplicar profissional pra mesma pessoa.
  const owner = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true },
  });

  // Já existe um Professional vinculado ao dono (criado pelo hook)? Renomeia pro
  // nome real e garante notifyWhatsapp=false. Idempotente.
  if (owner) {
    const ownerPro = await prisma.professional.findFirst({
      where: { companyId, userId: owner.id },
    });
    if (ownerPro) {
      if (ownerPro.name !== PROFESSIONAL_NAME) {
        await prisma.professional.update({
          where: { id: ownerPro.id },
          data: { name: PROFESSIONAL_NAME, profession: 'Cabeleireira', notifyWhatsapp: false },
        });
        console.log(`Profissional do dono renomeada para "${PROFESSIONAL_NAME}".`);
      }
      return;
    }
  }

  const existing = await prisma.professional.findFirst({
    where: { companyId, name: PROFESSIONAL_NAME },
  });
  if (existing) {
    // Existe a "Fátima Lacerda" mas sem vínculo com o dono: vincula (idempotente).
    if (owner && !existing.userId) {
      await prisma.professional.update({
        where: { id: existing.id },
        data: { userId: owner.id, notifyWhatsapp: false },
      });
      console.log(`Profissional "${PROFESSIONAL_NAME}" vinculada ao dono.`);
    }
    return;
  }

  // Não existe ainda: cria já vinculada ao dono (helper garante idempotência e
  // notifyWhatsapp=false).
  if (owner) {
    await ensureOwnerProfessional(companyId, owner.id, PROFESSIONAL_NAME);
    console.log(`Profissional "${PROFESSIONAL_NAME}" criada (vinculada ao dono).`);
    return;
  }
  await prisma.professional.create({
    data: { companyId, name: PROFESSIONAL_NAME, profession: 'Cabeleireira', notifyWhatsapp: false },
  });
  console.log(`Profissional "${PROFESSIONAL_NAME}" criada.`);
}

async function ensureCustomer(companyId: string, c: Cust) {
  let customer = await prisma.customer.findFirst({
    where: { companyId, name: c.name },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        companyId,
        name: c.name,
        phone: c.phone ?? null,
        birthday: c.birthday ? new Date(c.birthday) : null,
      },
    });
  } else if (c.phone && !customer.phone) {
    await prisma.customer.update({ where: { id: customer.id }, data: { phone: c.phone } });
  }

  if (c.note) {
    const text = `${MARK} ${c.note}`;
    const noteExists = await prisma.customerNote.findFirst({
      where: { customerId: customer.id, text },
    });
    if (!noteExists) {
      await prisma.customerNote.create({ data: { customerId: customer.id, text } });
    }
  }
  return customer;
}

async function main() {
  const target = process.env.DATABASE_URL?.includes('amazonaws.com') ? 'PRODUÇÃO (RDS)' : 'LOCAL';
  console.log(`\n=== Import Fátima Cabelos → ${target} ===`);

  const companyId = await ensureCompany();
  await ensureProfessional(companyId);

  let created = 0;
  for (const c of CUSTOMERS) {
    const before = await prisma.customer.count({ where: { companyId } });
    await ensureCustomer(companyId, c);
    const after = await prisma.customer.count({ where: { companyId } });
    if (after > before) created++;
  }

  const totals = {
    empresa: COMPANY_NAME,
    clientes: await prisma.customer.count({ where: { companyId } }),
    profissionais: await prisma.professional.count({ where: { companyId } }),
    notasBelasis: await prisma.customerNote.count({
      where: { customer: { companyId }, text: { startsWith: MARK } },
    }),
  };
  console.log(`Clientes novos nesta execução: ${created}`);
  console.log('Totais no tenant:', totals);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
