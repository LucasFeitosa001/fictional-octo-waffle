/**
 * Seeds (or repairs) the admin Better Auth credential.
 *
 *   admin@beautypass.dev / beautypass123
 *
 * Idempotent: if the credential already exists, it's left alone. If the user
 * row exists (from the Prisma seed) but has no Better Auth account, we create
 * the credential and keep the user linked to the existing "Salão Beautypass".
 *
 * Run with:  pnpm --filter @beautypass/api seed:admin
 */
import { prisma } from '@beautypass/db';
import { auth } from './better-auth';

const ADMIN_EMAIL = 'admin@beautypass.dev';
const ADMIN_PASSWORD = 'beautypass123';
const ADMIN_NAME = 'Bela Admin';

async function main() {
  // Already has a Better Auth credential? Done.
  const existingUser = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    include: { accounts: true },
  });
  const hasCredential = existingUser?.accounts.some((a) => a.providerId === 'credential');

  if (existingUser && hasCredential) {
    console.log(`Admin credential already present for ${ADMIN_EMAIL}. Nothing to do.`);
    return;
  }

  const company = await prisma.company.findFirst({ where: { name: 'Salão Beautypass' } });

  if (existingUser && !hasCredential) {
    // User row exists (seeded) but no Better Auth account yet.
    // Better Auth signUpEmail creates a NEW user, so to attach a credential to
    // the EXISTING user we remove the placeholder row first, then sign up, then
    // re-link to the original company. Simplest: delete placeholder, recreate.
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  const res = await auth.api.signUpEmail({
    body: { name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });

  // signUpEmail triggers the databaseHook which provisions a fresh company.
  // Re-point the admin at the canonical seeded company (if it exists) and drop
  // the auto-created one to avoid orphans.
  if (company) {
    const created = await prisma.user.findUnique({
      where: { id: res.user.id },
      select: { companyId: true },
    });
    if (created?.companyId && created.companyId !== company.id) {
      const autoCompanyId = created.companyId;
      await prisma.userCompany.deleteMany({ where: { userId: res.user.id } });
      const role =
        (await prisma.role.findFirst({
          where: { companyId: company.id, name: 'Administrador' },
        })) ??
        (await prisma.role.create({
          data: { companyId: company.id, name: 'Administrador' },
        }));
      await prisma.user.update({
        where: { id: res.user.id },
        data: { companyId: company.id },
      });
      await prisma.userCompany.create({
        data: { userId: res.user.id, companyId: company.id, roleId: role.id },
      });
      // Remove the throwaway auto-provisioned company (cascades its role/links).
      await prisma.company.delete({ where: { id: autoCompanyId } }).catch(() => undefined);
    }
  }

  console.log(`Admin ready: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
