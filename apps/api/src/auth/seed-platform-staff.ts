/**
 * Cria (ou promove) o PRIMEIRO técnico da SalonPass — o único que não pode
 * nascer pelo próprio console, porque ainda não há ninguém para criá-lo.
 * Ver estudo 135.
 *
 *   pnpm --filter @beautypass/api seed:platform-staff
 *
 * Variáveis:
 *   PLATFORM_STAFF_EMAIL     obrigatória
 *   PLATFORM_STAFF_NAME      opcional (default: parte antes do @)
 *   PLATFORM_STAFF_PASSWORD  opcional — ausente ⇒ gera e imprime UMA vez
 *
 * Idempotente: rodar de novo com o mesmo e-mail promove a conta a `owner` e a
 * reativa, sem tocar na senha. É o caminho de recuperação para quando o último
 * administrador se tranca do lado de fora.
 */
import { prisma } from '@beautypass/db';
import { hashPassword } from 'better-auth/crypto';
import { generateTemporaryPassword } from '../modules/users/users.module';

async function main(): Promise<void> {
  const email = (process.env.PLATFORM_STAFF_EMAIL ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error(
      'Defina PLATFORM_STAFF_EMAIL com o e-mail do primeiro técnico. Ex.: PLATFORM_STAFF_EMAIL=voce@salonpass.com.br pnpm --filter @beautypass/api seed:platform-staff',
    );
  }

  const nome = (process.env.PLATFORM_STAFF_NAME ?? '').trim() || email.split('@')[0]!;
  const existente = await prisma.platformStaff.findUnique({ where: { email } });

  if (existente) {
    await prisma.platformStaff.update({
      where: { id: existente.id },
      data: { role: 'owner', active: true, failedLoginCount: 0, lockedUntil: null },
    });
    // eslint-disable-next-line no-console
    console.log(
      `[platform] ${email} já existia — promovido a owner, reativado e destravado. Senha inalterada.`,
    );
    return;
  }

  const informada = process.env.PLATFORM_STAFF_PASSWORD?.trim();
  const senha = informada || generateTemporaryPassword(16);

  await prisma.platformStaff.create({
    data: {
      name: nome,
      email,
      role: 'owner',
      passwordHash: await hashPassword(senha),
      // Mesmo o primeiro troca no primeiro acesso: uma senha que passou por
      // variável de ambiente já esteve no histórico do shell e no log de quem
      // rodou o comando.
      mustChangePassword: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`[platform] técnico criado: ${email} (owner)`);
  if (!informada) {
    // eslint-disable-next-line no-console
    console.log(`[platform] senha temporária (aparece uma única vez): ${senha}`);
  }
  // eslint-disable-next-line no-console
  console.log('[platform] a troca de senha é obrigatória no primeiro acesso.');
}

main()
  .catch((erro) => {
    // eslint-disable-next-line no-console
    console.error('[platform] falhou:', erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
