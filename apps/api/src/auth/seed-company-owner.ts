import { hashPassword } from 'better-auth/crypto';
import { prisma } from '@beautypass/db';
import { seedCompanyRoles } from '@beautypass/db/rbac';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

async function main() {
  const companyName = required('OWNER_COMPANY_NAME');
  const name = required('OWNER_NAME');
  const email = required('OWNER_EMAIL').toLowerCase();
  const password = required('OWNER_PASSWORD');

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('OWNER_EMAIL inválido.');
  if (password.length < 12) throw new Error('OWNER_PASSWORD deve ter pelo menos 12 caracteres.');

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
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, companyId: true },
  });
  if (existing?.companyId && existing.companyId !== company.id) {
    throw new Error('Este e-mail já pertence a outra empresa.');
  }

  const professional = await prisma.professional.findFirst({
    where: { companyId: company.id, name: { equals: name, mode: 'insensitive' }, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!professional) throw new Error(`Profissional não encontrado: ${name}.`);
  if (professional.userId && professional.userId !== existing?.id) {
    throw new Error('O profissional já está vinculado a outro usuário.');
  }

  const { ownerRoleId } = await seedCompanyRoles(prisma, company.id);
  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            companyId: company.id,
            accountType: 'staff',
            name,
            email,
            provider: 'local',
            active: true,
          },
        })
      : await tx.user.create({
          data: {
            companyId: company.id,
            accountType: 'staff',
            name,
            email,
            provider: 'local',
            active: true,
          },
        });

    const credential = await tx.account.findFirst({
      where: { userId: saved.id, providerId: 'credential' },
      select: { id: true },
    });
    if (credential) {
      await tx.account.update({
        where: { id: credential.id },
        data: { accountId: saved.id, password: passwordHash },
      });
    } else {
      await tx.account.create({
        data: {
          userId: saved.id,
          providerId: 'credential',
          accountId: saved.id,
          password: passwordHash,
        },
      });
    }

    await tx.userCompany.upsert({
      where: { userId_companyId: { userId: saved.id, companyId: company.id } },
      update: { roleId: ownerRoleId, permissions: [] },
      create: { userId: saved.id, companyId: company.id, roleId: ownerRoleId },
    });
    await tx.professional.update({
      where: { id: professional.id },
      data: { userId: saved.id },
    });
    await tx.session.deleteMany({ where: { userId: saved.id } });

    return saved;
  });

  console.log(
    JSON.stringify({
      company: { id: company.id, name: company.name },
      user: { id: user.id, name: user.name, email: user.email, active: user.active },
      role: 'owner',
      professionalId: professional.id,
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
