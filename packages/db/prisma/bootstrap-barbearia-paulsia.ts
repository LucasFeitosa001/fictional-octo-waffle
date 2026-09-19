import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';

const NOME = 'Barbearia Paulista';
const SOURCE = 'bootstrap-barbearia-paulsia';

const servicos = [
  { key: 'corte-masculino', name: 'Corte de cabelo masculino', price: 35, durationMin: 30, todos: true },
  { key: 'corte-navalhado', name: 'Corte de cabelo navalhado', price: 40, durationMin: 30, todos: true },
  { key: 'corte-infantil', name: 'Corte infantil', price: 30, durationMin: 30, todos: true },
  { key: 'relaxamento', name: 'Relaxamento', price: 80, durationMin: 60, todos: false },
  { key: 'selagem', name: 'Selagem', price: 120, durationMin: 120, todos: false },
  { key: 'progressiva', name: 'Progressiva', price: 180, durationMin: 180, todos: false },
  { key: 'sobrancelha', name: 'Sobrancelha', price: 15, durationMin: 15, todos: true },
  { key: 'pintura', name: 'Pintura (qualquer cor)', price: 35, durationMin: 60, todos: false },
  { key: 'nevou', name: 'Nevou', price: 190, durationMin: 180, todos: false },
  { key: 'luzes-platinado', name: 'Luzes e platinado', price: 140, durationMin: 180, todos: false },
  { key: 'luzes-loiras', name: 'Luzes loiras', price: 80, durationMin: 120, todos: false },
] as const;

const produtos = [
  { key: 'gel-cola-don-edu-men', name: 'Gel Cola Don Edu Men Power Fixação 300g', salePrice: 30, unit: 'g' },
  { key: 'pomada-modeladora-don-edu-men', name: 'Pomada Modeladora Fixadora Don Edu Men 150g', salePrice: 40, unit: 'g' },
  { key: 'cera-modeladora-infinity-uva', name: "Cera Modeladora Infinity Look's Hair Uva 100g", salePrice: 40, unit: 'g' },
  { key: 'esponja-para-penteado', name: 'Esponja para penteado (dupla)', salePrice: 70, unit: 'un' },
  { key: 'shampoo-anticaspa-dom-pelo', name: 'Shampoo Anticaspa Dom Pelo 250ml', salePrice: 45, unit: 'ml' },
  { key: 'escova-massageadora-cabelo', name: 'Escova massageadora para cabelo', salePrice: 5, unit: 'un' },
  { key: 'desodorante-old-spice-matador', name: 'Desodorante Spray Old Spice Matador 150ml', salePrice: 18, unit: 'ml' },
  { key: 'perfume-natura-homem', name: 'Perfume Natura Homem 25ml', salePrice: 65, unit: 'ml' },
  { key: 'perfume-natura-ilia-secreto', name: 'Perfume Natura Ilía Secreto 50ml', salePrice: 199.90, unit: 'ml' },
  { key: 'cerveja-heineken-lata', name: 'Cerveja Heineken Original lata 269ml', salePrice: 5, unit: 'ml' },
  { key: 'cerveja-budweiser-lata', name: 'Cerveja Budweiser lata', salePrice: 5, unit: 'un' },
  { key: 'cerveja-amstel-lager-lata', name: 'Cerveja Amstel Lager lata', salePrice: 5, unit: 'un' },
  { key: 'cerveja-stella-artois', name: 'Cerveja Stella Artois 330ml', salePrice: 10, unit: 'ml' },
  { key: 'cerveja-corona-extra', name: 'Cerveja Corona Extra', salePrice: 10, unit: 'un' },
  { key: 'cerveja-skol-lata', name: 'Cerveja Skol Pilsen lata 269ml', salePrice: 5, unit: 'ml' },
  { key: 'red-bull-energy-drink', name: 'Red Bull Energy Drink 250ml', salePrice: 12, unit: 'ml' },
  { key: 'cerveja-spaten', name: 'Cerveja Spaten', salePrice: 10, unit: 'un' },
  { key: 'cerveja-skol-garrafa', name: 'Cerveja Skol garrafa', salePrice: 10, unit: 'un' },
  { key: 'cerveja-heineken-garrafa', name: 'Cerveja Heineken Original garrafa 330ml', salePrice: 10, unit: 'ml' },
  { key: 'guarana-antarctica-zero', name: 'Guaraná Antarctica Zero 200ml', salePrice: 3, unit: 'ml' },
  { key: 'fys-guarana-amazonia', name: 'FYS Refrigerante de Guaraná da Amazônia', salePrice: 5, unit: 'un' },
  { key: 'cajuina-sao-geraldo', name: 'Cajuína São Geraldo', salePrice: 8, unit: 'un' },
  { key: 'agua-viena-com-gas', name: 'Água Viena com gás 510ml', salePrice: 5, unit: 'ml' },
  { key: 'pepsi-lata', name: 'Pepsi lata', salePrice: 5, unit: 'un' },
  { key: 'skinka-frutas-citricas', name: 'Skinka sabor frutas cítricas', salePrice: 8, unit: 'un' },
  { key: 'guarana-antarctica-lata', name: 'Guaraná Antarctica lata', salePrice: 5, unit: 'un' },
  { key: 'h2oh-limao', name: 'H2OH! Limão 500ml', salePrice: 8, unit: 'ml' },
] as const;

const profissionais = [
  { key: 'erisvaldo', name: 'Erisvaldo', position: 'Dono e barbeiro' },
  { key: 'julio-cesar', name: 'Júlio César', position: 'Barbeiro' },
  { key: 'vinicius', name: 'Vinicius', position: 'Barbeiro' },
] as const;

async function categoria(tx: Prisma.TransactionClient, companyId: string, name: string) {
  const existente = await tx.productCategory.findFirst({ where: { companyId, name } });
  if (existente) {
    return tx.productCategory.update({
      where: { id: existente.id },
      data: { active: true },
    });
  }
  return tx.productCategory.create({ data: { companyId, name, active: true } });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const existentes = await tx.company.findMany({
        where: { name: { equals: NOME, mode: 'insensitive' } },
        select: { id: true, name: true },
        take: 2,
      });
      if (existentes.length !== 1) {
        throw new Error(
          existentes.length === 0
            ? `Empresa não encontrada: ${NOME}.`
            : `Há mais de uma empresa chamada ${NOME}.`,
        );
      }

      const empresa = await tx.company.update({
        where: { id: existentes[0].id },
        data: {
          active: true,
          timezone: 'America/Sao_Paulo',
          businessHoursActive: true,
          businessHoursJson: [
            { weekday: 0, open: false, start: '08:00', end: '20:00' },
            ...[1, 2, 3, 4, 5, 6].map((weekday) => ({
              weekday,
              open: true,
              start: '08:00',
              end: '20:00',
            })),
          ] as Prisma.InputJsonValue,
        },
        select: { id: true, name: true, active: true, businessHoursJson: true },
      });

      const categoriaServicos = await categoria(tx, empresa.id, 'Serviços de barbearia');
      const categoriaProdutos = await categoria(tx, empresa.id, 'Produtos para barba e cabelo');

      const servicosSalvos = [];
      for (const item of servicos) {
        const exclusivo = !item.todos;
        servicosSalvos.push(
          await tx.service.upsert({
            where: {
              companyId_legacyId: {
                companyId: empresa.id,
                legacyId: `${SOURCE}:service:${item.key}`,
              },
            },
            update: {
              categoryId: categoriaServicos.id,
              name: item.name,
              price: item.price,
              priceType: 'fixo',
              durationMin: item.durationMin,
              description: exclusivo
                ? 'Serviço realizado exclusivamente por Erisvaldo.'
                : item.key.startsWith('corte-')
                  ? 'Atendimento para todos os tipos de cabelo.'
                  : 'Serviço realizado por todos os barbeiros.',
              onlineBookable: true,
              visible: true,
              active: true,
              deletedAt: null,
            },
            create: {
              companyId: empresa.id,
              categoryId: categoriaServicos.id,
              legacyId: `${SOURCE}:service:${item.key}`,
              legacySource: SOURCE,
              name: item.name,
              price: item.price,
              priceType: 'fixo',
              durationMin: item.durationMin,
              description: exclusivo
                ? 'Serviço realizado exclusivamente por Erisvaldo.'
                : item.key.startsWith('corte-')
                  ? 'Atendimento para todos os tipos de cabelo.'
                  : 'Serviço realizado por todos os barbeiros.',
              onlineBookable: true,
              visible: true,
              active: true,
            },
            select: { id: true, legacyId: true, name: true, price: true, durationMin: true },
          }),
        );
      }

      const profissionaisSalvos = [];
      for (const item of profissionais) {
        profissionaisSalvos.push(
          await tx.professional.upsert({
            where: {
              companyId_legacyId: {
                companyId: empresa.id,
                legacyId: `${SOURCE}:professional:${item.key}`,
              },
            },
            update: {
              name: item.name,
              profession: 'Barbeiro',
              position: item.position,
              notes:
                item.key === 'vinicius'
                  ? 'Atende somente aos sábados.'
                  : item.key === 'erisvaldo'
                    ? 'Dono. Intervalo de almoço das 12:00 às 14:00.'
                    : null,
              onlineBookable: true,
              notifyWhatsapp: false,
              active: true,
              generateSchedule: true,
              deletedAt: null,
            },
            create: {
              companyId: empresa.id,
              legacyId: `${SOURCE}:professional:${item.key}`,
              legacySource: SOURCE,
              name: item.name,
              profession: 'Barbeiro',
              position: item.position,
              notes:
                item.key === 'vinicius'
                  ? 'Atende somente aos sábados.'
                  : item.key === 'erisvaldo'
                    ? 'Dono. Intervalo de almoço das 12:00 às 14:00.'
                    : null,
              onlineBookable: true,
              notifyWhatsapp: false,
              active: true,
              generateSchedule: true,
            },
            select: { id: true, legacyId: true, name: true },
          }),
        );
      }

      const idPorProfissional = new Map(
        profissionaisSalvos.map((p) => [p.legacyId!.split(':').at(-1)!, p.id]),
      );
      const erisvaldoId = idPorProfissional.get('erisvaldo')!;
      const julioId = idPorProfissional.get('julio-cesar')!;
      const viniciusId = idPorProfissional.get('vinicius')!;

      await tx.professionalSchedule.deleteMany({
        where: { professionalId: { in: [erisvaldoId, julioId, viniciusId] } },
      });
      await tx.professionalSchedule.createMany({
        data: [
          ...[1, 2, 3, 4, 5, 6].flatMap((weekday) => [
            { professionalId: erisvaldoId, weekday, startTime: '08:00', endTime: '12:00' },
            { professionalId: erisvaldoId, weekday, startTime: '14:00', endTime: '20:00' },
          ]),
          ...[1, 2, 3, 4, 5, 6].map((weekday) => ({
            professionalId: julioId,
            weekday,
            startTime: '08:00',
            endTime: '20:00',
          })),
          { professionalId: viniciusId, weekday: 6, startTime: '08:00', endTime: '20:00' },
        ],
      });

      const idsServicos = servicosSalvos.map((s) => s.id);
      await tx.professionalService.deleteMany({
        where: {
          professionalId: { in: [erisvaldoId, julioId, viniciusId] },
          serviceId: { in: idsServicos },
        },
      });
      const servicoPorLegacyId = new Map(servicosSalvos.map((s) => [s.legacyId, s.id]));
      const servicosDeTodos = servicos
        .filter((s) => s.todos)
        .map((s) => servicoPorLegacyId.get(`${SOURCE}:service:${s.key}`)!);
      await tx.professionalService.createMany({
        data: [
          ...idsServicos.map((serviceId) => ({ professionalId: erisvaldoId, serviceId })),
          ...servicosDeTodos.map((serviceId) => ({ professionalId: julioId, serviceId })),
          ...servicosDeTodos.map((serviceId) => ({ professionalId: viniciusId, serviceId })),
        ],
        skipDuplicates: true,
      });

      const produtosSalvos = [];
      for (const item of produtos) {
        produtosSalvos.push(
          await tx.product.upsert({
            where: {
              companyId_legacyId: {
                companyId: empresa.id,
                legacyId: `${SOURCE}:product:${item.key}`,
              },
            },
            update: {
              categoryId: categoriaProdutos.id,
              name: item.name,
              salePrice: item.salePrice,
              stock: 1,
              unit: item.unit,
              trackStock: true,
              active: true,
              deletedAt: null,
            },
            create: {
              companyId: empresa.id,
              categoryId: categoriaProdutos.id,
              legacyId: `${SOURCE}:product:${item.key}`,
              legacySource: SOURCE,
              name: item.name,
              salePrice: item.salePrice,
              stock: 1,
              unit: item.unit,
              trackStock: true,
              active: true,
            },
            select: { id: true, name: true, salePrice: true },
          }),
        );
      }

      const slug = 'barbearia-paulsia';
      const linkExistente = await tx.bookingLink.findUnique({ where: { slug } });
      if (linkExistente && linkExistente.companyId !== empresa.id) {
        throw new Error(`O link público ${slug} já pertence a outra empresa.`);
      }
      const link = linkExistente
        ? await tx.bookingLink.update({ where: { id: linkExistente.id }, data: { active: true } })
        : await tx.bookingLink.create({ data: { companyId: empresa.id, slug, active: true } });

      return {
        empresa,
        servicos: servicosSalvos,
        produtos: produtosSalvos,
        profissionais: profissionaisSalvos,
        link: link.active ? link.slug : null,
      };
    });

    console.log(
      JSON.stringify({
        companyId: resultado.empresa.id,
        nome: resultado.empresa.name,
        ativa: resultado.empresa.active,
        servicos: resultado.servicos.length,
        produtos: resultado.produtos.length,
        profissionais: resultado.profissionais.map((p) => p.name),
        link: resultado.link,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
