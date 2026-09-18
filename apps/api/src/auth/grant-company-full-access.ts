import { prisma } from '@beautypass/db';
import { seedCompanyRoles } from '@beautypass/db/rbac';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

async function main() {
  const companyName = required('ACCESS_COMPANY_NAME');
  const email = required('ACCESS_OWNER_EMAIL').toLowerCase();

  const companies = await prisma.company.findMany({
    where: { name: { equals: companyName, mode: 'insensitive' } },
    select: { id: true, name: true },
    take: 2,
  });
  if (companies.length !== 1) {
    throw new Error(
      companies.length === 0
        ? `Empresa não encontrada: ${companyName}.`
        : `Há mais de uma empresa chamada ${companyName}.`,
    );
  }
  const company = companies[0];
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, companyId: true, name: true, email: true },
  });
  if (!user || user.companyId !== company.id) {
    throw new Error('O proprietário não pertence à empresa informada.');
  }

  const [roles, maxPlan] = await Promise.all([
    seedCompanyRoles(prisma, company.id),
    prisma.plan.findUnique({ where: { name: 'max' } }),
  ]);
  if (!maxPlan) throw new Error('Plano Max não encontrado.');

  const latestSubscription = await prisma.subscription.findFirst({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  const subscription = await prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id: company.id }, data: { active: true } });
    await tx.user.update({ where: { id: user.id }, data: { active: true } });
    await tx.userCompany.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      update: { roleId: roles.ownerRoleId, permissions: [] },
      create: { userId: user.id, companyId: company.id, roleId: roles.ownerRoleId },
    });

    if (latestSubscription) {
      return tx.subscription.update({
        where: { id: latestSubscription.id },
        data: { planId: maxPlan.id, status: 'active', currentPeriodEnd: null },
        include: { plan: true },
      });
    }
    return tx.subscription.create({
      data: {
        companyId: company.id,
        planId: maxPlan.id,
        status: 'active',
      },
      include: { plan: true },
    });
  });

  console.log(
    JSON.stringify({
      company,
      user: { id: user.id, name: user.name, email: user.email },
      role: 'owner',
      permissions: ['*'],
      plan: subscription.plan.name,
      status: subscription.status,
      features: subscription.plan.featuresJson,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
