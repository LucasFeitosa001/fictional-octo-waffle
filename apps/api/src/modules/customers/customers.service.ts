import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdjustCashbackDto,
  CreateCustomerAnamnesisDto,
  CreateCustomerDebtDto,
  CreateCustomerDebtPaymentDto,
  CreateCustomerDto,
  CreateCustomerFileDto,
  CreateCustomerNoteDto,
  RedeemCashbackDto,
  UpdateCustomerAnamnesisDto,
  UpdateCustomerDto,
} from './dto';

// Prisma Decimal | number | null -> number (0 when nullish).
const num = (v: unknown): number => (v == null ? 0 : Number(v));

/**
 * Aniversário é DATA, não instante — grava sempre à MEIA-NOITE UTC.
 *
 * `new Date('1990-05-10')` já dá meia-noite UTC (a spec manda ler data pura como
 * UTC), e é essa a convenção que o painel espera na volta (`toDateInput` lê em
 * UTC de propósito, format.ts). O problema é o outro formato: um ISO COM hora e
 * SEM fuso ("1990-05-10T00:00:00", que qualquer cliente da API pode mandar e o
 * `@IsISO8601` aceita) o Node interpreta no fuso do CONTAINER — num servidor a
 * leste de Greenwich isso grava 1990-05-09T22:00Z e a data de nascimento nasce
 * um dia atrás, para sempre. Aqui o dia escolhido é o dia gravado, dê no que der
 * o fuso da máquina.
 */
function dataDeAniversario(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return new Date(iso);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * IDs de clientes da empresa cujo TELEFONE/2º telefone/CPF/CNPJ casam com
   * `padrao` comparando **só os dígitos**.
   *
   * Existe porque a base não guarda um formato só: a mesma pessoa aparece como
   * '(89) 98129-1426', '89981291426' e '+55 89 99457-2834'. Um `contains` do
   * Prisma compara a STRING, então quem digita o número sem máscara não acha o
   * cadastro com máscara (e vice-versa) — foi assim que nasceram as duplicatas
   * confirmadas na base. `regexp_replace` normaliza no banco, que é o único
   * lugar onde dá para comparar sem trazer a tabela inteira para a aplicação.
   *
   * Devolve lista vazia (nunca lança) quando não há `$queryRaw`: os fixtures de
   * teste montam um Prisma falso, e a busca não pode deixar de funcionar por
   * causa da passada extra. Mesma guarda de commissions.service.ts:516.
   */
  private async idsPorDigitos(companyId: string, padrao: string): Promise<string[]> {
    const client = this.prisma.client as unknown as { $queryRaw?: unknown };
    if (typeof client.$queryRaw !== 'function') return [];
    try {
      const linhas = await this.prisma.client.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Customer"
        WHERE "companyId" = ${companyId}
          AND "deletedAt" IS NULL
          AND (
            regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g') LIKE ${padrao}
            OR regexp_replace(COALESCE("secondaryPhone", ''), '[^0-9]', '', 'g') LIKE ${padrao}
            OR regexp_replace(COALESCE("cpf", ''), '[^0-9]', '', 'g') LIKE ${padrao}
            OR regexp_replace(COALESCE("cnpj", ''), '[^0-9]', '', 'g') LIKE ${padrao}
          )
        LIMIT 200
      `;
      return linhas.map((l) => l.id);
    } catch {
      return [];
    }
  }

  /**
   * Onde a busca da tela de Clientes procura.
   *
   * Antes era SÓ o nome. A atendente pergunta o telefone à cliente, digita
   * "98129-1426", recebe "Nenhum cliente encontrado" e cadastra de novo — é o
   * gerador nº 1 de ficha duplicada (histórico, cashback e débito partidos em
   * duas). Agora procura nome, apelido, e-mail e — por dígitos — telefone,
   * segundo telefone, CPF e CNPJ.
   */
  private async condicoesDeBusca(
    companyId: string,
    termo: string,
  ): Promise<Prisma.CustomerWhereInput[]> {
    const contem = { contains: termo, mode: 'insensitive' as const };
    const condicoes: Prisma.CustomerWhereInput[] = [
      { name: contem },
      { nickname: contem },
      { email: contem },
      // O texto CRU também casa com a base legada, que gravou o telefone com
      // máscara ('(89) 98129-1426').
      { phone: { contains: termo } },
    ];
    const digitos = termo.replace(/\D/g, '');
    // Menos de 4 dígitos ("11") casaria com meia base e não ajuda ninguém.
    if (digitos.length >= 4) {
      condicoes.push(
        { phone: { contains: digitos } },
        { secondaryPhone: { contains: digitos } },
        { cpf: { contains: digitos } },
        { cnpj: { contains: digitos } },
      );
      const ids = await this.idsPorDigitos(companyId, `%${digitos}%`);
      if (ids.length) condicoes.push({ id: { in: ids } });
    }
    return condicoes;
  }

  async list(
    companyId: string,
    search?: string,
    page = 1,
    pageSize = 20,
    filters?: { active?: boolean; hasDebt?: boolean },
  ) {
    const termo = (search ?? '').trim();
    const busca = termo ? await this.condicoesDeBusca(companyId, termo) : null;
    const where: Prisma.CustomerWhereInput = {
      companyId,
      deletedAt: null,
      ...(filters?.active !== undefined ? { active: filters.active } : {}),
      ...(filters?.hasDebt === true
        ? { debts: { some: { status: 'open' } } }
        : filters?.hasDebt === false
          ? { debts: { none: { status: 'open' } } }
          : {}),
      ...(busca ? { OR: busca } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.client.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
        include: {
          tags: true,
          debts: {
            where: { status: 'open' },
            select: {
              amount: true,
              payments: { select: { amount: true } },
            },
          },
        },
      }),
      this.prisma.client.customer.count({ where }),
    ]);
    return {
      data: data.map(({ debts, ...customer }) => ({
        ...customer,
        debtBalance: debts.reduce((sum, debt) => {
          const paid = debt.payments.reduce(
            (paymentSum, payment) => paymentSum + num(payment.amount),
            0,
          );
          return sum + Math.max(num(debt.amount) - paid, 0);
        }, 0),
      })),
      page,
      pageSize,
      total,
    };
  }

  async findOne(companyId: string, id: string) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { tags: true, dependents: true, socialProfiles: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    return customer;
  }

  // Valida indicação: o referredById precisa existir, pertencer à mesma empresa
  // e não pode ser o próprio cliente (auto-indicação).
  private async assertValidReferral(
    companyId: string,
    referredById?: string,
    selfId?: string,
  ) {
    if (!referredById) return;
    if (selfId && referredById === selfId) {
      throw new BadRequestException('Cliente não pode indicar a si mesmo');
    }
    const referrer = await this.prisma.client.customer.findFirst({
      where: { id: referredById, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!referrer) throw new NotFoundException('Cliente indicador não encontrado');
  }

  /**
   * AVISA que já existe ficha com este telefone — e deixa criar assim mesmo.
   *
   * A duplicata é real e frequente (na base: 'Adriana Araújo' e 'Mãe Adriana'
   * com o mesmo 89994008076; 'Scheila' e 'Sheila' com o mesmo número em
   * formatos diferentes), e cada uma parte histórico, cashback e débito em duas
   * fichas. Mas BLOQUEAR é decisão do dono, não minha: mãe e filha usando o
   * mesmo celular é caso legítimo, e o mesmo POST atende a criação em linha do
   * agendamento, onde travar deixaria a recepção sem saída no meio do
   * atendimento. Então o cadastro nasce e o aviso vai junto na resposta.
   *
   * Compara pelos ÚLTIMOS 8 dígitos — mesma convenção de `listInteractions` e do
   * WhatsappService — para casar variações de +55, DDD e nono dígito.
   */
  private async avisoDeDuplicidade(
    companyId: string,
    telefone: string | null | undefined,
  ): Promise<string | undefined> {
    const digitos = String(telefone ?? '').replace(/\D/g, '');
    if (digitos.length < 8) return undefined;
    const ids = await this.idsPorDigitos(companyId, `%${digitos.slice(-8)}`);
    if (!ids.length) return undefined;
    const iguais = await this.prisma.client.customer.findMany({
      where: { id: { in: ids }, companyId, deletedAt: null },
      select: { name: true },
      orderBy: { name: 'asc' },
      take: 3,
    });
    if (!iguais.length) return undefined;
    const nomes = iguais.map((c) => c.name).join(', ');
    return `Atenção: já existe cadastro com este telefone (${nomes}). O cliente foi criado assim mesmo — confira se não é a mesma pessoa.`;
  }

  async create(companyId: string, dto: CreateCustomerDto) {
    await this.assertValidReferral(companyId, dto.referredById);
    // ANTES de gravar, senão o próprio cadastro recém-criado entraria na conta.
    const avisoDuplicidade = await this.avisoDeDuplicidade(companyId, dto.phone);
    const { birthday, tags, dependents, socialProfiles, ...rest } = dto;
    const criado = await this.prisma.client.customer.create({
      data: {
        ...rest,
        companyId,
        ...(birthday ? { birthday: dataDeAniversario(birthday) } : {}),
        ...(tags
          ? {
              tags: {
                connectOrCreate: tags.map((name) => ({
                  where: { companyId_name: { companyId, name } },
                  create: { companyId, name },
                })),
              },
            }
          : {}),
        ...(dependents
          ? {
              dependents: {
                create: dependents.map((d) => ({ name: d.name, relationship: d.relationship })),
              },
            }
          : {}),
        ...(socialProfiles
          ? {
              socialProfiles: {
                create: socialProfiles.map((s) => ({ platform: s.platform, url: s.url })),
              },
            }
          : {}),
      },
      include: { tags: true, dependents: true, socialProfiles: true },
    });
    // O aviso viaja junto com o cliente criado: quem chamou decide como mostrar
    // (o painel levanta um toque amarelo). Sem campo extra quando não há nada a
    // avisar — resposta honesta, sem chave morta.
    return avisoDuplicidade ? { ...criado, avisoDuplicidade } : criado;
  }

  async update(companyId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(companyId, id);
    await this.assertValidReferral(companyId, dto.referredById, id);
    const { birthday, tags, dependents, socialProfiles, ...rest } = dto;
    return this.prisma.client.customer.update({
      where: { id },
      data: {
        // `...rest` carrega os NULOS de propósito: no PATCH, chave ausente é
        // "não mexa" e `null` é "apague" (estudo 141). É o que finalmente
        // permite tirar do cadastro um telefone que é de outra pessoa.
        ...rest,
        ...(birthday !== undefined
          ? { birthday: birthday ? dataDeAniversario(birthday) : null }
          : {}),
        // Tags: replace the whole set with the provided names (connectOrCreate).
        ...(tags
          ? {
              tags: {
                set: [],
                connectOrCreate: tags.map((name) => ({
                  where: { companyId_name: { companyId, name } },
                  create: { companyId, name },
                })),
              },
            }
          : {}),
        // Dependents/social profiles: if the collection is provided, replace it.
        ...(dependents
          ? {
              dependents: {
                deleteMany: {},
                create: dependents.map((d) => ({ name: d.name, relationship: d.relationship })),
              },
            }
          : {}),
        ...(socialProfiles
          ? {
              socialProfiles: {
                deleteMany: {},
                create: socialProfiles.map((s) => ({ platform: s.platform, url: s.url })),
              },
            }
          : {}),
      },
      include: { tags: true, dependents: true, socialProfiles: true },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    // Soft-delete: stamp deletedAt so the customer disappears from admin lists
    // while preserving the row and all of its history (appointments, orders,
    // packages, memberships, campaign messages). `active` is left untouched.
    return this.prisma.client.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // GET /customers/:id/panel — métricas reais do cliente (Cliente — profundidade).
  async panel(companyId: string, id: string) {
    const customer = await this.findOne(companyId, id);

    const [
      faturamentoAgg,
      debitosAbertos,
      creditosAgg,
      cashbackAgg,
      pacotesEmAberto,
      comandasEmAberto,
      pagamentosEmAberto,
      appointments,
      orders,
    ] = await Promise.all([
      // Faturamento: comandas finalizadas do cliente.
      this.prisma.client.order.aggregate({
        _sum: { netTotal: true },
        where: { companyId, customerId: id, status: 'finished' },
      }),
      // Débitos em aberto — com pagamentos para calcular o saldo real.
      this.prisma.client.customerDebt.findMany({
        where: { companyId, customerId: id, status: 'open' },
        include: { payments: { select: { amount: true } } },
      }),
      // Saldo de créditos (escopado pela empresa via relação do cliente).
      this.prisma.client.customerCredit.aggregate({
        _sum: { amount: true },
        where: { customerId: id, customer: { companyId } },
      }),
      // Saldo de cashback (escopado pela empresa via relação do cliente).
      // Exclui os lotes VENCIDOS: sem isto a ficha mostrava um saldo maior do que
      // o resgate aceita (orders.service.ts:663 já filtra por validade), e o
      // cliente ouvia "Saldo de cashback insuficiente" olhando para o número.
      this.prisma.client.customerCashback.aggregate({
        _sum: { amount: true },
        where: {
          customerId: id,
          customer: { companyId },
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
      }),
      // Pacotes ativos em aberto.
      this.prisma.client.customerPackage.count({
        where: { companyId, customerId: id, status: 'active' },
      }),
      // As duas CONTAGENS do bloco "Informações" da coluna do cliente. Ficam
      // aqui, e não em hooks separados no front, porque a coluna já dispara
      // packages + notes: buscar comandas e débitos à parte daria 5 requisições
      // toda vez que alguém abre uma comanda — e listar 100 comandas inteiras só
      // para contar as abertas é desperdício. Aqui são dois count indexados
      // dentro do Promise.all que já existe.
      this.prisma.client.order.count({
        where: { companyId, customerId: id, status: 'open' },
      }),
      // Mesmo recorte de `debitosAbertos` acima, contando em vez de trazer as
      // linhas (`debitosTotal` é SOMA em dinheiro, não quantidade).
      this.prisma.client.customerDebt.count({
        where: { companyId, customerId: id, status: 'open' },
      }),
      // Histórico recente de agendamentos — só o que JÁ ACONTECEU e não foi
      // desmarcado. Sem o corte de data, o que está agendado para semana que
      // vem entrava em "últimos serviços" e deixava `diasSemVir` NEGATIVO.
      // Ver estudo 54.
      this.prisma.client.appointment.findMany({
        where: {
          companyId,
          customerId: id,
          status: { not: 'canceled' },
          start: { lte: new Date() },
        },
        orderBy: { start: 'desc' },
        take: 10,
        include: { items: { include: { service: true } } },
      }),
      // Histórico recente de comandas — cancelada não é visita nem venda.
      this.prisma.client.order.findMany({
        where: { companyId, customerId: id, status: { not: 'canceled' } },
        orderBy: { date: 'desc' },
        take: 10,
        include: { items: true },
      }),
    ]);

    // Última visita: max entre agendamentos e comandas.
    const dates = [
      ...appointments.map((a) => a.start),
      ...orders.map((o) => o.date),
    ];
    const lastVisitAt =
      dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
    const diasSemVir =
      lastVisitAt != null
        ? Math.floor((Date.now() - lastVisitAt.getTime()) / 86_400_000)
        : null;

    // NOME dos itens de comanda: o item guarda `kind` + `refId`, e sem resolver
    // isso o histórico do cliente virava "Serviço · Serviço · Produto".
    // Duas consultas em lote, não uma por item. Ver estudo 54.
    const refsServico = [
      ...new Set(
        orders.flatMap((o) => o.items.filter((i) => i.kind === 'service').map((i) => i.refId)),
      ),
    ];
    const refsProduto = [
      ...new Set(
        orders.flatMap((o) => o.items.filter((i) => i.kind === 'product').map((i) => i.refId)),
      ),
    ];
    const [servicosDosItens, produtosDosItens] = await Promise.all([
      refsServico.length
        ? this.prisma.client.service.findMany({
            where: { companyId, id: { in: refsServico } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      refsProduto.length
        ? this.prisma.client.product.findMany({
            where: { companyId, id: { in: refsProduto } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const nomePorRef = new Map<string, string>([
      ...servicosDosItens.map((x) => [x.id, x.name] as const),
      ...produtosDosItens.map((x) => [x.id, x.name] as const),
    ]);

    const itensDeComanda = orders.flatMap((o) =>
      o.items.map((it) => ({
        source: 'order' as const,
        date: o.date,
        status: o.status as string,
        name: nomePorRef.get(it.refId) ?? null,
        kind: it.kind as string,
        refId: it.refId,
        price: num(it.grossValue),
      })),
    );

    /**
     * A MESMA visita não pode aparecer duas vezes.
     *
     * O agendamento que virou comanda é um atendimento só. Com o vínculo novo
     * (`Order.appointmentId`, estudo 52) dá para descartar com certeza; no
     * histórico importado, que não tem o vínculo, cai na regra do par
     * "mesmo dia + mesmo nome de item" — que é como o salão de fato opera.
     */
    const agendamentosComComanda = new Set(
      orders.map((o) => o.appointmentId).filter((x): x is string => Boolean(x)),
    );
    const diaENome = new Set(
      itensDeComanda.map((i) => `${i.date.toISOString().slice(0, 10)}|${(i.name ?? '').toLowerCase()}`),
    );

    const itensDeAgendamento = appointments.flatMap((a) =>
      a.items
        .filter((it) => {
          if (agendamentosComComanda.has(a.id)) return false;
          const chave = `${a.start.toISOString().slice(0, 10)}|${(it.service?.name ?? '').toLowerCase()}`;
          return !diaENome.has(chave);
        })
        .map((it) => ({
          source: 'appointment' as const,
          date: a.start,
          status: a.status as string,
          name: it.service?.name ?? null,
          serviceId: it.serviceId,
          price: num(it.price),
        })),
    );

    // Últimos serviços/itens (comanda + agendamento sem comanda), máx 10.
    const ultimosServicos = [...itensDeAgendamento, ...itensDeComanda]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);

    // Débitos: saldo real (amount - pagamentos) de cada débito em aberto,
    // alinhado com a aba Débitos.
    const debitosTotal = debitosAbertos.reduce((acc, debt) => {
      const paid = debt.payments.reduce((sum, pmt) => sum + num(pmt.amount), 0);
      return acc + Math.max(num(debt.amount) - paid, 0);
    }, 0);

    return {
      customer,
      faturamento: num(faturamentoAgg._sum.netTotal),
      lastVisitAt,
      diasSemVir,
      debitosTotal,
      creditosSaldo: num(creditosAgg._sum.amount),
      cashbackSaldo: num(cashbackAgg._sum.amount),
      pacotesEmAberto,
      comandasEmAberto,
      pagamentosEmAberto,
      ultimosServicos,
    };
  }

  // ===== Débitos =====

  async listDebts(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerDebt.findMany({
      where: { companyId, customerId: id },
      orderBy: { createdAt: 'desc' },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    });
  }

  async createDebt(companyId: string, id: string, dto: CreateCustomerDebtDto) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerDebt.create({
      data: {
        companyId,
        customerId: id,
        amount: dto.amount,
        origin: dto.origin,
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        status: 'open',
      },
      include: { payments: true },
    });
  }

  async addDebtPayment(
    companyId: string,
    id: string,
    debtId: string,
    dto: CreateCustomerDebtPaymentDto,
  ) {
    await this.findOne(companyId, id);
    // (Estudo 132) TUDO em uma transação interativa com advisory lock por
    // débito. Sem isso, dois `POST /customers/:id/debts/:debtId/payments`
    // simultâneos de R$100 num débito de R$100 leem `prevPaidAgg=0` os dois,
    // passam a trava de saldo, e criam dois `CustomerDebtPayment` → o débito
    // fica com R$200 pagos sobre R$100 devidos, e o status vira 'paid' cedo
    // demais.
    return this.prisma.client.$transaction(async (tx) => {
      // O lock é PELO DÉBITO: pagamentos em débitos DIFERENTES do mesmo
      // cliente não competem. Xact_lock morre no fim da tx.
      if (typeof (tx as unknown as { $queryRaw?: unknown }).$queryRaw === 'function') {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext(${debtId})::bigint)
        `;
      }
      const debt = await tx.customerDebt.findFirst({
        where: { id: debtId, companyId, customerId: id },
      });
      if (!debt) throw new NotFoundException('Débito não encontrado');

      const prevPaidAgg = await tx.customerDebtPayment.aggregate({
        _sum: { amount: true },
        where: { debtId },
      });
      const saldo = num(debt.amount) - num(prevPaidAgg._sum.amount);
      if (saldo <= 0) {
        throw new BadRequestException('Débito já está quitado');
      }
      if (dto.amount > saldo) {
        throw new BadRequestException(
          'Pagamento excede o saldo devedor restante do débito',
        );
      }

      await tx.customerDebtPayment.create({
        data: { debtId, amount: dto.amount, method: dto.method },
      });

      // Recalcula status: paid quando o total pago cobre o valor do débito.
      const totalPaid = num(prevPaidAgg._sum.amount) + dto.amount;
      const status = totalPaid >= num(debt.amount) ? 'paid' : 'open';

      return tx.customerDebt.update({
        where: { id: debtId },
        data: { status },
        include: { payments: { orderBy: { paidAt: 'desc' } } },
      });
    });
  }

  // ===== Créditos =====

  async listCredits(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const [credits, cashback] = await Promise.all([
      this.prisma.client.customerCredit.findMany({
        where: { customerId: id, customer: { companyId } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.customerCashback.findMany({
        where: { customerId: id, customer: { companyId } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const creditosSaldo = credits.reduce((acc, c) => acc + num(c.amount), 0);
    const cashbackSaldo = cashback.reduce((acc, c) => acc + num(c.amount), 0);
    return { credits, cashback, creditosSaldo, cashbackSaldo };
  }

  /**
   * GET /customers/:id/balance — helper p/ a comanda exibir "Crédito"/"Cashback".
   * creditBalance = soma de todo o ledger de crédito.
   * cashbackBalance = soma somente das linhas de cashback não vencidas (expiresAt >= now).
   */
  async balance(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const now = new Date();
    const [creditAgg, cashbackRows] = await Promise.all([
      this.prisma.client.customerCredit.aggregate({
        _sum: { amount: true },
        where: { customerId: id, customer: { companyId } },
      }),
      this.prisma.client.customerCashback.findMany({
        where: {
          customerId: id,
          customer: { companyId },
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        select: { amount: true },
      }),
    ]);
    const creditBalance = num(creditAgg._sum.amount);
    const cashbackBalance = cashbackRows.reduce((acc, r) => acc + num(r.amount), 0);
    return { creditBalance, cashbackBalance };
  }

  // ===== Cashback (extrato dedicado) =====

  async listCashback(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const now = new Date();
    const cashback = await this.prisma.client.customerCashback.findMany({
      where: { customerId: id, customer: { companyId } },
      orderBy: { createdAt: 'desc' },
    });
    // O extrato continua completo para auditoria, mas o saldo precisa coincidir
    // com o que pode ser resgatado. Antes uma linha vencida aparecia corretamente
    // no histórico e, ao mesmo tempo, inflava o saldo exibido.
    const saldo = cashback
      .filter((c) => !c.expiresAt || c.expiresAt >= now)
      .reduce((acc, c) => acc + num(c.amount), 0);
    return { cashback, saldo };
  }

  private async cashbackBalanceUsing(
    client: Prisma.TransactionClient | PrismaService['client'],
    companyId: string,
    id: string,
  ): Promise<number> {
    const rows = await client.customerCashback.findMany({
      where: {
        customerId: id,
        customer: { companyId },
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      select: { amount: true },
    });
    return rows.reduce((acc, r) => acc + num(r.amount), 0);
  }

  /**
   * POST /customers/:id/cashback/redeem — resgata cashback do cliente.
   * Insere uma linha NEGATIVA no ledger. Respeita o programa global da empresa
   * (cashbackCanRedeem) e valida saldo suficiente.
   */
  async redeemCashback(companyId: string, id: string, dto: RedeemCashbackDto) {
    await this.findOne(companyId, id);
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:cashback:${id}`}))`,
      );
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { cashbackCanRedeem: true },
      });
      if (company && company.cashbackCanRedeem === false) {
        throw new BadRequestException('Resgate de cashback desativado no programa.');
      }
      const saldo = await this.cashbackBalanceUsing(tx, companyId, id);
      if (dto.amount > saldo) {
        throw new BadRequestException('Saldo de cashback insuficiente.');
      }
      const entry = await tx.customerCashback.create({
        data: {
          customerId: id,
          amount: new Prisma.Decimal(-Math.abs(dto.amount)),
          sourceType: 'redeem',
        },
      });
      return { entry, saldo: saldo - Math.abs(dto.amount) };
    });
  }

  /**
   * POST /customers/:id/cashback/adjust — ajuste manual (crédito ou débito).
   * amount positivo credita, negativo debita. expiresAt opcional (crédito).
   */
  async adjustCashback(companyId: string, id: string, dto: AdjustCashbackDto) {
    await this.findOne(companyId, id);
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:cashback:${id}`}))`,
      );
      if (dto.amount < 0) {
        const saldoAtual = await this.cashbackBalanceUsing(tx, companyId, id);
        if (Math.abs(dto.amount) > saldoAtual) {
          throw new BadRequestException('Saldo de cashback insuficiente.');
        }
      }
      const entry = await tx.customerCashback.create({
        data: {
          customerId: id,
          amount: new Prisma.Decimal(dto.amount),
          sourceType: 'adjust',
          ...(dto.expiresAt ? { expiresAt: new Date(dto.expiresAt) } : {}),
        },
      });
      const saldo = await this.cashbackBalanceUsing(tx, companyId, id);
      return { entry, saldo };
    });
  }

  // ===== Agendamentos =====

  async listAppointments(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.appointment.findMany({
      where: { companyId, customerId: id },
      orderBy: { start: 'desc' },
      take: 100,
      include: {
        items: { include: { service: { select: { id: true, name: true } } } },
        professional: { select: { id: true, name: true } },
      },
    });
  }

  // ===== Vendas / Comandas =====

  async listOrders(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const orders = await this.prisma.client.order.findMany({
      where: { companyId, customerId: id },
      orderBy: { date: 'desc' },
      take: 100,
      include: {
        items: true,
        professional: { select: { id: true, name: true } },
      },
    });

    // NOME de cada item. O `OrderItem` guarda `kind` + `refId`, e a aba Vendas
    // imprimia a palavra "Serviço" para todos — cinco itens viravam
    // "Serviço · Serviço · Serviço". Duas consultas em lote resolvem a lista
    // inteira. Ver estudo 54.
    const porTipo = (kind: string) => [
      ...new Set(
        orders.flatMap((o) => o.items.filter((i) => i.kind === kind).map((i) => i.refId)),
      ),
    ];
    const idsServico = porTipo('service');
    const idsProduto = porTipo('product');
    const [servicos, produtos] = await Promise.all([
      idsServico.length
        ? this.prisma.client.service.findMany({
            where: { companyId, id: { in: idsServico } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      idsProduto.length
        ? this.prisma.client.product.findMany({
            where: { companyId, id: { in: idsProduto } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const nomePorRef = new Map<string, string>([
      ...servicos.map((x) => [x.id, x.name] as const),
      ...produtos.map((x) => [x.id, x.name] as const),
    ]);

    return orders.map((o) => ({
      ...o,
      items: o.items.map((it) => ({ ...it, itemName: nomePorRef.get(it.refId) ?? null })),
    }));
  }

  // ===== Pacotes =====

  async listPackages(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerPackage.findMany({
      where: { companyId, customerId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, name: true } },
        items: { include: { service: { select: { id: true, name: true } } } },
      },
    });
  }

  // ===== Anotações =====

  async listNotes(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerNote.findMany({
      where: { customerId: id, customer: { companyId } },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async createNote(
    companyId: string,
    id: string,
    authorId: string | undefined,
    dto: CreateCustomerNoteDto,
  ) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerNote.create({
      data: { customerId: id, text: dto.text, authorId: authorId ?? null },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  // ===== Imagens e Arquivos =====

  async listFiles(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerFile.findMany({
      where: { customerId: id, companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addFile(companyId: string, id: string, dto: CreateCustomerFileDto) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerFile.create({
      data: {
        companyId,
        customerId: id,
        url: dto.url,
        name: dto.name,
        mimeType: dto.mimeType ?? null,
        size: dto.size ?? null,
      },
    });
  }

  async removeFile(companyId: string, id: string, fileId: string) {
    await this.findOne(companyId, id);
    const found = await this.prisma.client.customerFile.findFirst({
      where: { id: fileId, customerId: id, companyId },
    });
    if (!found) throw new NotFoundException('Arquivo não encontrado');
    await this.prisma.client.customerFile.delete({ where: { id: fileId } });
    return { id: fileId, deleted: true };
  }

  // ===== Anamneses =====

  async listAnamneses(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerAnamnesis.findMany({
      where: { customerId: id, customer: { companyId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAnamnesis(
    companyId: string,
    id: string,
    dto: CreateCustomerAnamnesisDto,
  ) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerAnamnesis.create({
      data: {
        customerId: id,
        templateId: dto.templateId ?? null,
        ...(dto.answersJson
          ? { answersJson: dto.answersJson as Prisma.InputJsonValue }
          : {}),
        ...(dto.signedAt ? { signedAt: new Date(dto.signedAt) } : {}),
      },
    });
  }

  /** Garante que a ficha pertence a um cliente da empresa; senão 404. */
  private async ensureAnamnesis(companyId: string, id: string, anamId: string) {
    const found = await this.prisma.client.customerAnamnesis.findFirst({
      where: { id: anamId, customerId: id, customer: { companyId } },
    });
    if (!found) throw new NotFoundException('Ficha de anamnese não encontrada');
    return found;
  }

  /**
   * PATCH /customers/:id/anamneses/:anamId — atualiza respostas e/ou assinatura.
   * signedAt === null "des-assina"; string ISO assina; undefined mantém.
   */
  async updateAnamnesis(
    companyId: string,
    id: string,
    anamId: string,
    dto: UpdateCustomerAnamnesisDto,
  ) {
    await this.findOne(companyId, id);
    const atual = await this.ensureAnamnesis(companyId, id, anamId);
    if (atual.signedAt) {
      throw new BadRequestException(
        'Esta anamnese já foi assinada e é imutável para preservar a auditoria.',
      );
    }
    return this.prisma.client.customerAnamnesis.update({
      where: { id: anamId },
      data: {
        ...(dto.answersJson !== undefined
          ? { answersJson: dto.answersJson as Prisma.InputJsonValue }
          : {}),
        ...(dto.signedAt !== undefined
          ? { signedAt: dto.signedAt ? new Date(dto.signedAt) : null }
          : {}),
      },
    });
  }

  /** DELETE /customers/:id/anamneses/:anamId */
  async removeAnamnesis(companyId: string, id: string, anamId: string) {
    await this.findOne(companyId, id);
    const atual = await this.ensureAnamnesis(companyId, id, anamId);
    if (atual.signedAt) {
      throw new BadRequestException(
        'Esta anamnese já foi assinada e não pode ser excluída.',
      );
    }
    await this.prisma.client.customerAnamnesis.delete({ where: { id: anamId } });
    return { id: anamId, deleted: true };
  }

  // ===== Interações (histórico de mensagens) =====

  // GET /customers/:id/interactions — timeline unificada das mensagens enviadas
  // ao cliente (feature "Interações" do Belasis). Mescla:
  //   (a) WhatsappOutbox onde customerId = :id OU o telefone casa com o do cliente
  //       (comparação pelos últimos 8 dígitos — cobre variações de +55/DDD/9º dígito);
  //   (b) CampaignMessage do cliente (texto vem de Campaign.segmentJson.message).
  // Ordena por `at` desc e pagina por limit/offset.
  async listInteractions(
    companyId: string,
    id: string,
    limit = 50,
    offset = 0,
  ) {
    const customer = await this.findOne(companyId, id);

    // Últimos 8 dígitos do telefone do cliente — chave estável entre variações
    // de código de país/DDD/9º dígito (mesma convenção do WhatsappService).
    const phoneDigits = (customer.phone ?? '').replace(/\D/g, '');
    const phoneTail = phoneDigits.length >= 8 ? phoneDigits.slice(-8) : null;

    // (a) Outbox: por customerId direto OU por telefone que "case" com o cliente.
    // O match por telefone é feito na aplicação (endsWith) porque o outbox guarda
    // só dígitos e pode ter registros antigos sem customerId.
    const outboxRows = await this.prisma.client.whatsappOutbox.findMany({
      where: {
        // ESCOPO DE EMPRESA obrigatório: o ramo por telefone casa pelo FINAL do
        // número, então sem este filtro dois salões com sufixo coincidente viam
        // metadados de mensagem um do outro. `companyId` é nullable no schema —
        // registros antigos sem empresa continuam acessíveis apenas quando já
        // estão ligados ao cliente desta empresa (ramo customerId).
        AND: [
          { companyId },
          {
            OR: [
              { customerId: id },
              ...(phoneTail ? [{ toPhone: { endsWith: phoneTail } }] : []),
            ],
          },
        ],
      },
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
      // Busca uma janela ampla p/ mesclar+paginar em memória (o volume por cliente
      // é pequeno; a paginação real é aplicada depois do merge).
      take: 500,
    });

    // (b) Campanhas do cliente (a mensagem fica no segmentJson da campanha).
    const campaignRows = await this.prisma.client.campaignMessage.findMany({
      where: { customerId: id, campaign: { companyId } },
      orderBy: { sentAt: 'desc' },
      take: 500,
      include: {
        campaign: { select: { name: true, channel: true, segmentJson: true } },
      },
    });

    type Interaction = {
      id: string;
      channel: 'whatsapp' | 'campaign';
      kind: string | null;
      text: string;
      status: string;
      at: Date;
      direction: 'outgoing';
    };

    const items: Interaction[] = [];

    for (const o of outboxRows) {
      // Defesa em profundidade: mocks, views futuras ou regressões de query não
      // podem transformar a timeline numa janela para mensagens de outro salão.
      if (o.companyId !== companyId) continue;
      items.push({
        id: o.id,
        channel: 'whatsapp',
        kind: o.kind ?? null,
        text: o.text,
        status: o.status,
        at: o.sentAt ?? o.createdAt,
        direction: 'outgoing',
      });
    }

    for (const c of campaignRows) {
      const seg = c.campaign?.segmentJson as { message?: unknown } | null;
      const message =
        typeof seg?.message === 'string' && seg.message.trim()
          ? seg.message
          : (c.campaign?.name ?? 'Campanha');
      items.push({
        id: c.id,
        channel: 'campaign',
        kind: 'campaign',
        text: message,
        status: c.status,
        // CampaignMessage não tem createdAt; usa sentAt ou "agora" como fallback.
        at: c.sentAt ?? new Date(0),
        direction: 'outgoing',
      });
    }

    // Ordena por `at` desc e aplica a paginação simples.
    items.sort((a, b) => b.at.getTime() - a.at.getTime());
    const total = items.length;
    const paged = items.slice(offset, offset + limit);

    return { data: paged, total, limit, offset };
  }
}
