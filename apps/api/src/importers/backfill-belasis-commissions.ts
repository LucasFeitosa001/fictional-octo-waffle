/**
 * Backfill auditável de comissões do Belasis.
 *
 * O arquivo de entrada NÃO contém clientes/telefones. Ele é normalizado a partir
 * dos relatórios XLS e guarda somente:
 *   - comissão padrão por serviço;
 *   - número da comanda, profissional, competência, base, comissão e status.
 *
 * Dry-run (padrão):
 *   pnpm --filter @beautypass/api backfill:belasis-commissions -- \
 *     --input /tmp/beautypass-fatima-commission-backfill.json
 *
 * Aplicar:
 *   pnpm --filter @beautypass/api backfill:belasis-commissions -- \
 *     --input /tmp/beautypass-fatima-commission-backfill.json --apply
 *
 * Idempotência: antes de criar, compara comanda + profissional + competência +
 * base + comissão. Um segundo run não duplica os lançamentos.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma, prisma } from '@beautypass/db';

type EntryStatus = 'open' | 'paid';

interface ServiceDefaultInput {
  name: string;
  percent: number;
}

interface CommissionEntryInput {
  orderNumber: number;
  professionalName: string;
  competenceDate: string; // YYYY-MM-DD
  baseAmount: number;
  commissionAmount: number;
  status: EntryStatus;
}

interface BackfillInput {
  version: 1;
  companyName: string;
  source: string;
  serviceDefaults: ServiceDefaultInput[];
  entries: CommissionEntryInput[];
}

const apply = process.argv.includes('--apply');

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function cents(value: Prisma.Decimal | number): number {
  return Math.round(Number(value) * 100);
}

function dateKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function entryKey(
  orderId: string,
  professionalId: string,
  competenceDate: Date | string,
  baseAmount: Prisma.Decimal | number,
  commissionAmount: Prisma.Decimal | number,
): string {
  return [
    orderId,
    professionalId,
    dateKey(competenceDate),
    cents(baseAmount),
    cents(commissionAmount),
  ].join('|');
}

function money(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

async function main() {
  const inputArg = argValue('--input');
  if (!inputArg) throw new Error('Informe --input <arquivo.json>');

  const input = JSON.parse(readFileSync(resolve(inputArg), 'utf8')) as BackfillInput;
  if (input.version !== 1 || !input.companyName || !Array.isArray(input.entries)) {
    throw new Error('Arquivo de backfill inválido ou com versão não suportada');
  }

  const company = await prisma.company.findFirst({
    where: { name: input.companyName },
    select: { id: true, name: true },
  });
  if (!company) throw new Error(`Empresa "${input.companyName}" não encontrada`);

  const columnCheck = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Service'
        AND column_name = 'defaultCommissionPercent'
    ) AS "exists"
  `;
  const hasServiceCommissionColumn = Boolean(columnCheck[0]?.exists);
  const servicesPromise = hasServiceCommissionColumn
    ? prisma.service.findMany({
        where: { companyId: company.id, deletedAt: null },
        select: { id: true, name: true, defaultCommissionPercent: true },
      })
    : prisma.service
        .findMany({
          where: { companyId: company.id, deletedAt: null },
          select: { id: true, name: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            ...row,
            defaultCommissionPercent: new Prisma.Decimal(0),
          })),
        );

  const [services, professionals, orders, existingEntries] = await Promise.all([
    servicesPromise,
    prisma.professional.findMany({
      where: { companyId: company.id, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.order.findMany({
      where: { companyId: company.id },
      select: {
        id: true,
        number: true,
        legacyId: true,
        items: {
          select: {
            professionalId: true,
            professional: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.commissionEntry.findMany({
      where: { companyId: company.id, status: { not: 'reversed' } },
      select: {
        orderId: true,
        professionalId: true,
        competenceDate: true,
        baseAmount: true,
        commissionAmount: true,
      },
    }),
  ]);

  const servicesByName = new Map<string, typeof services>();
  for (const service of services) {
    const key = norm(service.name);
    servicesByName.set(key, [...(servicesByName.get(key) ?? []), service]);
  }
  const professionalsByName = new Map<string, typeof professionals>();
  for (const professional of professionals) {
    const key = norm(professional.name);
    professionalsByName.set(key, [
      ...(professionalsByName.get(key) ?? []),
      professional,
    ]);
  }
  const professionalUseCount = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      if (!item.professionalId) continue;
      professionalUseCount.set(
        item.professionalId,
        (professionalUseCount.get(item.professionalId) ?? 0) + 1,
      );
    }
  }
  const ordersByNumber = new Map(orders.map((order) => [order.number, order]));
  // Durante a importação inicial algumas comandas precisaram ser renumeradas
  // para não colidir com números já usados. O número original do relatório foi
  // preservado como `cmd:<número>` em legacyId e é a chave correta para cruzar
  // os XLS do Belasis. Comandas nativas continuam resolvidas pelo número atual.
  const ordersByLegacyNumber = new Map<number, (typeof orders)[number]>();
  for (const order of orders) {
    const match = order.legacyId?.match(/^cmd:(\d+)$/);
    if (match) ordersByLegacyNumber.set(Number(match[1]), order);
  }
  const existingKeys = new Set(
    existingEntries
      .filter(
        (entry): entry is typeof entry & {
          orderId: string;
          competenceDate: Date;
        } => Boolean(entry.orderId && entry.competenceDate),
      )
      .map((entry) =>
        entryKey(
          entry.orderId,
          entry.professionalId,
          entry.competenceDate,
          entry.baseAmount,
          entry.commissionAmount,
        ),
      ),
  );

  const serviceUpdates: { id: string; name: string; percent: number }[] = [];
  const serviceProblems: string[] = [];
  for (const desired of input.serviceDefaults) {
    const matches = servicesByName.get(norm(desired.name)) ?? [];
    if (matches.length !== 1) {
      serviceProblems.push(
        `${desired.name}: ${matches.length === 0 ? 'não encontrado' : 'nome ambíguo'}`,
      );
      continue;
    }
    const service = matches[0];
    if (cents(service.defaultCommissionPercent) !== cents(desired.percent)) {
      serviceUpdates.push({ id: service.id, name: service.name, percent: desired.percent });
    }
  }

  const creates: Prisma.CommissionEntryCreateManyInput[] = [];
  const entryProblems: string[] = [];
  let alreadyPresent = 0;

  for (const desired of input.entries) {
    if (
      desired.commissionAmount <= 0 ||
      desired.baseAmount <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(desired.competenceDate)
    ) {
      entryProblems.push(
        `#${desired.orderNumber}/${desired.professionalName}: valores ou data inválidos`,
      );
      continue;
    }
    const order =
      ordersByLegacyNumber.get(desired.orderNumber) ??
      ordersByNumber.get(desired.orderNumber);
    if (!order) {
      entryProblems.push(`#${desired.orderNumber}: comanda não encontrada`);
      continue;
    }

    // O banco contém dois cadastros com grafia equivalente de Fátima Lacerda.
    // A própria comanda é a fonte mais confiável para escolher o profissional.
    const orderProfessionalIds = new Set(
      order.items
        .filter(
          (item) =>
            item.professional &&
            norm(item.professional.name) === norm(desired.professionalName),
        )
        .map((item) => item.professionalId)
        .filter((id): id is string => Boolean(id)),
    );

    let professionalId: string | undefined;
    if (orderProfessionalIds.size === 1) {
      professionalId = [...orderProfessionalIds][0];
    } else if (orderProfessionalIds.size > 1) {
      entryProblems.push(
        `#${desired.orderNumber}/${desired.professionalName}: mais de um profissional na comanda`,
      );
      continue;
    } else {
      const globalMatches = professionalsByName.get(norm(desired.professionalName)) ?? [];
      if (globalMatches.length === 1) {
        professionalId = globalMatches[0].id;
      } else if (globalMatches.length > 1) {
        // Migrações antigas podem ter criado a mesma pessoa duas vezes apenas
        // por diferença de caixa/acentuação. Quando o item legado veio sem FK,
        // escolhemos o cadastro que já concentra o histórico de comandas.
        const ranked = [...globalMatches].sort(
          (a, b) =>
            (professionalUseCount.get(b.id) ?? 0) -
            (professionalUseCount.get(a.id) ?? 0),
        );
        const firstCount = professionalUseCount.get(ranked[0].id) ?? 0;
        const secondCount = professionalUseCount.get(ranked[1].id) ?? 0;
        if (firstCount > secondCount) professionalId = ranked[0].id;
      }
    }
    if (!professionalId) {
      entryProblems.push(
        `#${desired.orderNumber}/${desired.professionalName}: profissional não resolvido`,
      );
      continue;
    }

    const competenceDate = new Date(`${desired.competenceDate}T12:00:00.000Z`);
    const key = entryKey(
      order.id,
      professionalId,
      competenceDate,
      desired.baseAmount,
      desired.commissionAmount,
    );
    if (existingKeys.has(key)) {
      alreadyPresent++;
      continue;
    }
    existingKeys.add(key);
    creates.push({
      companyId: company.id,
      professionalId,
      orderId: order.id,
      baseAmount: new Prisma.Decimal(desired.baseAmount),
      commissionAmount: new Prisma.Decimal(desired.commissionAmount),
      bonusAmount: new Prisma.Decimal(0),
      status: desired.status,
      competenceDate,
      availableDate: competenceDate,
    });
  }

  const totals = creates.reduce(
    (acc, entry) => {
      const amount = Number(entry.commissionAmount);
      acc.total += amount;
      acc[entry.status === 'open' ? 'open' : 'paid'] += amount;
      return acc;
    },
    { total: 0, open: 0, paid: 0 },
  );

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'APPLY' : 'DRY-RUN',
        company,
        source: input.source,
        catalog: {
          schemaReady: hasServiceCommissionColumn,
          input: input.serviceDefaults.length,
          updates: serviceUpdates.length,
          problems: serviceProblems,
        },
        entries: {
          input: input.entries.length,
          create: creates.length,
          alreadyPresent,
          problems: entryProblems,
          total: money(totals.total),
          paid: money(totals.paid),
          open: money(totals.open),
        },
      },
      null,
      2,
    ),
  );

  if (!apply) return;
  if (!hasServiceCommissionColumn) {
    throw new Error('Backfill abortado: aplique primeiro a migration do campo de comissão');
  }
  if (serviceProblems.length || entryProblems.length) {
    throw new Error(
      'Backfill abortado: resolva os itens não encontrados/ambíguos mostrados no dry-run',
    );
  }

  await prisma.$transaction(
    async (tx) => {
      for (const update of serviceUpdates) {
        await tx.service.update({
          where: { id: update.id },
          data: { defaultCommissionPercent: new Prisma.Decimal(update.percent) },
        });
      }
      if (creates.length) {
        await tx.commissionEntry.createMany({ data: creates });
      }
    },
    { timeout: 120_000 },
  );

  console.log(
    `Aplicado: ${serviceUpdates.length} serviços atualizados e ${creates.length} lançamentos criados.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
