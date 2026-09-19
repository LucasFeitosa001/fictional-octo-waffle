import 'dotenv/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

const COMPANY_NAME = 'Barbearia Paulista';
const SOURCE = 'catalogo-produtos-paulsia-2026-09-18';

type ProductDefinition = {
  key: string;
  image: string;
  name: string;
  price: number;
  unit?: string;
};

const products: ProductDefinition[] = [
  { key: 'gel-cola-don-edu-men', image: '17.30.01', name: 'Gel Cola Don Edu Men Power Fixação 300g', price: 30, unit: 'g' },
  { key: 'pomada-modeladora-don-edu-men', image: '17.30.15', name: 'Pomada Modeladora Fixadora Don Edu Men 150g', price: 40, unit: 'g' },
  { key: 'cera-modeladora-infinity-uva', image: '17.30.24', name: "Cera Modeladora Infinity Look's Hair Uva 100g", price: 40, unit: 'g' },
  { key: 'esponja-para-penteado', image: '17.30.50', name: 'Esponja para penteado (dupla)', price: 70, unit: 'un' },
  { key: 'shampoo-anticaspa-dom-pelo', image: '17.31.06', name: 'Shampoo Anticaspa Dom Pelo 250ml', price: 45, unit: 'ml' },
  { key: 'escova-massageadora-cabelo', image: '17.31.37', name: 'Escova massageadora para cabelo', price: 5, unit: 'un' },
  { key: 'desodorante-old-spice-matador', image: '17.32.19', name: 'Desodorante Spray Old Spice Matador 150ml', price: 18, unit: 'ml' },
  { key: 'perfume-natura-homem', image: '17.33.28', name: 'Perfume Natura Homem 25ml', price: 65, unit: 'ml' },
  { key: 'perfume-natura-ilia-secreto', image: '17.34.02', name: 'Perfume Natura Ilía Secreto 50ml', price: 199.90, unit: 'ml' },
  { key: 'cerveja-heineken-lata', image: '17.34.37', name: 'Cerveja Heineken Original lata 269ml', price: 5, unit: 'ml' },
  { key: 'cerveja-budweiser-lata', image: '17.34.55', name: 'Cerveja Budweiser lata', price: 5, unit: 'un' },
  { key: 'cerveja-amstel-lager-lata', image: '17.35.00', name: 'Cerveja Amstel Lager lata', price: 5, unit: 'un' },
  { key: 'cerveja-stella-artois', image: '17.35.38', name: 'Cerveja Stella Artois 330ml', price: 10, unit: 'ml' },
  { key: 'cerveja-corona-extra', image: '17.35.49', name: 'Cerveja Corona Extra', price: 10, unit: 'un' },
  { key: 'cerveja-skol-lata', image: '17.36.16', name: 'Cerveja Skol Pilsen lata 269ml', price: 5, unit: 'ml' },
  { key: 'red-bull-energy-drink', image: '17.36.25', name: 'Red Bull Energy Drink 250ml', price: 12, unit: 'ml' },
  { key: 'cerveja-spaten', image: '17.36.54', name: 'Cerveja Spaten', price: 10, unit: 'un' },
  { key: 'cerveja-skol-garrafa', image: '17.37.02', name: 'Cerveja Skol garrafa', price: 10, unit: 'un' },
  { key: 'cerveja-heineken-garrafa', image: '17.37.31', name: 'Cerveja Heineken Original garrafa 330ml', price: 10, unit: 'ml' },
  { key: 'guarana-antarctica-zero', image: '17.38.03', name: 'Guaraná Antarctica Zero 200ml', price: 3, unit: 'ml' },
  { key: 'fys-guarana-amazonia', image: '17.38.29', name: 'FYS Refrigerante de Guaraná da Amazônia', price: 5, unit: 'un' },
  { key: 'cajuina-sao-geraldo', image: '17.38.40', name: 'Cajuína São Geraldo', price: 8, unit: 'un' },
  { key: 'agua-viena-com-gas', image: '17.39.39', name: 'Água Viena com gás 510ml', price: 5, unit: 'ml' },
  { key: 'pepsi-lata', image: '17.39.50', name: 'Pepsi lata', price: 5, unit: 'un' },
  { key: 'skinka-frutas-citricas', image: '17.40.12', name: 'Skinka sabor frutas cítricas', price: 8, unit: 'un' },
  { key: 'guarana-antarctica-lata', image: '17.40.41', name: 'Guaraná Antarctica lata', price: 5, unit: 'un' },
  { key: 'h2oh-limao', image: '17.41.02', name: 'H2OH! Limão 500ml', price: 8, unit: 'ml' },
];

async function main() {
  const prisma = new PrismaClient();
  const repoRoot = path.resolve(__dirname, '../../..');
  const sourceDir = process.env.PRODUCT_IMAGE_SOURCE_DIR?.trim()
    || '/mnt/c/Users/Usuario/Downloads';
  const uploadDir = process.env.PRODUCT_UPLOAD_DIR?.trim()
    || path.join(repoRoot, 'apps/api/uploads');

  try {
    const requestedCompanyId = process.env.COMPANY_ID?.trim();
    const companies = requestedCompanyId
      ? await prisma.company.findMany({
          where: { id: requestedCompanyId },
          select: { id: true, name: true },
        })
      : await prisma.company.findMany({
          where: { name: { equals: COMPANY_NAME, mode: 'insensitive' } },
          select: { id: true, name: true },
          take: 2,
        });

    let company = companies.length === 1 ? companies[0] : null;
    if (!company && !requestedCompanyId && companies.length === 0) {
      const professionals = await prisma.professional.findMany({
        where: { name: { equals: 'Erisvaldo', mode: 'insensitive' } },
        select: { company: { select: { id: true, name: true } } },
        take: 2,
      });
      const companyIds = new Set(professionals.map((item) => item.company.id));
      if (companyIds.size === 1) company = professionals[0]?.company ?? null;
    }
    if (!company) {
      throw new Error(
        requestedCompanyId
          ? `Empresa não encontrada para COMPANY_ID=${requestedCompanyId}`
          : companies.length > 1
            ? `Há mais de uma empresa chamada ${COMPANY_NAME}`
            : `Empresa não encontrada por nome ou pelo profissional Erisvaldo`,
      );
    }
    await fs.mkdir(uploadDir, { recursive: true });

    const category =
      (await prisma.productCategory.findFirst({
        where: { companyId: company.id, name: 'Produtos e bebidas' },
      })) ??
      (await prisma.productCategory.create({
        data: { companyId: company.id, name: 'Produtos e bebidas', active: true },
      }));
    if (!category.active) {
      await prisma.productCategory.update({ where: { id: category.id }, data: { active: true } });
    }

    const saved: { name: string; price: number; imageUrl: string }[] = [];
    for (const item of products) {
      const sourceName = `WhatsApp Image 2026-09-14 at ${item.image}.jpeg`;
      const targetName = `${company.id}__product__${item.key}.jpeg`;
      await fs.copyFile(path.join(sourceDir, sourceName), path.join(uploadDir, targetName));

      const imageUrl = `/api/v1/uploads/public/${targetName}`;
      const row = await prisma.product.upsert({
        where: {
          companyId_legacyId: {
            companyId: company.id,
            legacyId: `${SOURCE}:${item.key}`,
          },
        },
        update: {
          categoryId: category.id,
          name: item.name,
          imageUrl,
          salePrice: item.price,
          stock: 1,
          unit: item.unit ?? 'un',
          trackStock: true,
          active: true,
          deletedAt: null,
        },
        create: {
          companyId: company.id,
          categoryId: category.id,
          legacyId: `${SOURCE}:${item.key}`,
          legacySource: SOURCE,
          name: item.name,
          imageUrl,
          salePrice: item.price,
          stock: 1,
          unit: item.unit ?? 'un',
          trackStock: true,
          active: true,
        },
        select: { name: true, salePrice: true, imageUrl: true },
      });
      saved.push({ name: row.name, price: Number(row.salePrice), imageUrl: row.imageUrl! });
    }

    console.log(JSON.stringify({ companyId: company.id, company: company.name, total: saved.length, products: saved }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
