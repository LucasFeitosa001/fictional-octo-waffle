const { Prisma, PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL deve estar definido para executar esta migração.');
}

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const beforeCount = await tx.service.count({
      where: { categoryId: { not: null } },
    });
    const beforeSample = await tx.service.findMany({
      where: { categoryId: { not: null } },
      select: { id: true, name: true, categoryId: true },
      orderBy: { id: 'asc' },
      take: 10,
    });
    console.log('Antes: serviços com categoria =', beforeCount);
    console.log('Antes: amostra =', beforeSample);

    const serviceCategories = await tx.serviceCategory.findMany({
      select: { id: true, companyId: true, name: true },
      orderBy: { id: 'asc' },
    });
    const categoryMap = new Map();

    for (const serviceCategory of serviceCategories) {
      const existing = await tx.productCategory.findFirst({
        where: {
          companyId: serviceCategory.companyId,
          name: serviceCategory.name,
        },
        orderBy: { createdAt: 'asc' },
      });
      const productCategory =
        existing ??
        (await tx.productCategory.create({
          data: {
            companyId: serviceCategory.companyId,
            name: serviceCategory.name,
          },
        }));

      categoryMap.set(serviceCategory.id, productCategory.id);
    }

    await tx.$executeRawUnsafe(
      'ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "Service_categoryId_fkey"',
    );

    for (const [serviceCategoryId, productCategoryId] of categoryMap) {
      await tx.$executeRaw(
        Prisma.sql`UPDATE "Service" SET "categoryId" = ${productCategoryId} WHERE "categoryId" = ${serviceCategoryId}`,
      );
    }

    await tx.$executeRawUnsafe(
      'ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    );

    const afterCount = await tx.service.count({
      where: { categoryId: { not: null } },
    });
    const afterSample = await tx.service.findMany({
      where: { categoryId: { not: null } },
      select: { id: true, name: true, categoryId: true },
      orderBy: { id: 'asc' },
      take: 10,
    });
    console.log('Depois: serviços com categoria =', afterCount);
    console.log('Depois: amostra =', afterSample);
  }, { timeout: 30_000, maxWait: 15_000 });
}

main()
  .catch((error) => {
    console.error('Falha ao unificar categorias de serviço:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
