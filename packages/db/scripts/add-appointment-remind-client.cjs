// NÃO EXECUTAR EM PRODUÇÃO SEM JANELA DE MANUTENÇÃO.
const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não está definida.');
}

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.appointment.count();
  console.log(`Agendamentos antes da alteração: ${before}`);

  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "remindClient" boolean;',
  );

  const after = await prisma.appointment.count();
  console.log(`Agendamentos depois da alteração: ${after}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
