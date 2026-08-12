import type { PrismaClient } from '@beautypass/db';

/**
 * Configuração financeira mínima de um salão recém-criado.
 *
 * O provisionamento criava papéis e o profissional do dono, mas nenhuma conta,
 * forma de pagamento ou categoria. O salão nascia sem conseguir registrar um
 * recebimento nem pagar comissão — os selects de "Forma de pagamento" e "Conta"
 * abriam vazios e não havia como concluir.
 *
 * As taxas e prazos de cartão são os padrões de mercado; o salão ajusta em
 * Financeiro → Cadastros. Melhor começar com um valor plausível e editável do
 * que com zero, que faz a conta fechar errado sem ninguém perceber.
 *
 * Idempotente: só cria o que ainda não existe, para poder rodar em empresa
 * antiga sem duplicar nada.
 */
export async function provisionFinanceiroPadrao(
  prisma: PrismaClient,
  companyId: string,
): Promise<{ contas: number; formas: number; categorias: number }> {
  let contas = 0;
  let formas = 0;
  let categorias = 0;

  async function conta(name: string, type: 'cash' | 'bank') {
    const existente = await prisma.financialAccount.findFirst({
      // `mode: 'insensitive'` porque a comparação exata já criou uma duplicata
      // ("PIX" x "Pix") ao rodar sobre empresa que tinha os dados à mão.
      where: { companyId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existente) return existente.id;
    contas += 1;
    const criada = await prisma.financialAccount.create({
      data: { companyId, name, type },
      select: { id: true },
    });
    return criada.id;
  }

  const caixaId = await conta('Caixa', 'cash');
  const bancoId = await conta('Conta bancária', 'bank');

  const formasPadrao = [
    // Dinheiro é o único que entra no caixa da recepção por padrão.
    { name: 'Dinheiro', goesToCash: true, defaultAccountId: caixaId },
    { name: 'Pix', goesToCash: false, defaultAccountId: bancoId },
    {
      name: 'Cartão de Crédito',
      goesToCash: false,
      feePercent: 3.5,
      settlementDays: 30,
      defaultAccountId: bancoId,
    },
    {
      name: 'Cartão de Débito',
      goesToCash: false,
      feePercent: 1.5,
      settlementDays: 1,
      defaultAccountId: bancoId,
    },
  ];
  for (const forma of formasPadrao) {
    const existente = await prisma.paymentMethod.findFirst({
      where: { companyId, name: { equals: forma.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existente) continue;
    await prisma.paymentMethod.create({ data: { companyId, ...forma } });
    formas += 1;
  }

  // Uma de receita e uma de despesa: são as que `finish()` e o pagamento de
  // comissão procuram para classificar o lançamento.
  const categoriasPadrao: { name: string; kind: 'credit' | 'debit' }[] = [
    { name: 'Serviços', kind: 'credit' },
    { name: 'Produtos', kind: 'credit' },
    { name: 'Comissões', kind: 'debit' },
    { name: 'Despesas gerais', kind: 'debit' },
  ];
  for (const categoria of categoriasPadrao) {
    const existente = await prisma.financialCategory.findFirst({
      where: {
        companyId,
        name: { equals: categoria.name, mode: 'insensitive' },
        kind: categoria.kind,
      },
      select: { id: true },
    });
    if (existente) continue;
    await prisma.financialCategory.create({ data: { companyId, ...categoria } });
    categorias += 1;
  }

  return { contas, formas, categorias };
}
