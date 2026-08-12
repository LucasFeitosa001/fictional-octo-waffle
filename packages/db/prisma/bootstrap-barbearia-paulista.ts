import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Cria a casca DORMENTE da Barbearia Paulista na SalonPass. Ver estudo 89.
 *
 * Não cria usuário, profissional, serviço, agenda, WhatsApp ou configurações
 * inventadas. A empresa nasce inativa e só serve para dar uma identidade
 * estável ao mapa Voltr↔SalonPass; o onboarding real completa e ativa depois.
 * Idempotente pelo nome enquanto não existe identificador público/slug no model.
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    const existentes = await prisma.company.findMany({
      where: { name: { equals: 'Barbearia Paulista', mode: 'insensitive' } },
      select: { id: true, name: true, active: true },
      take: 2,
    });
    if (existentes.length > 1) {
      throw new Error(
        'Há mais de uma empresa chamada Barbearia Paulista; resolva a duplicidade antes de mapear o tenant.',
      );
    }

    const empresa =
      existentes[0] ??
      (await prisma.company.create({
        data: {
          name: 'Barbearia Paulista',
          timezone: 'America/Sao_Paulo',
          currency: 'BRL',
          active: false,
        },
        select: { id: true, name: true, active: true },
      }));

    console.log(
      JSON.stringify({
        companyId: empresa.id,
        nome: empresa.name,
        ativa: empresa.active,
        estado: empresa.active ? 'já existia ativa' : 'dormente',
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
