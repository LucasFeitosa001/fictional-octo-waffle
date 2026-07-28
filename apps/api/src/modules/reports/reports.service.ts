import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Data válida ou undefined. */
function toDate(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Janela de datas com fim-de-dia: quando `to` é só data (YYYY-MM-DD) estica
 * até 23:59:59.999 (UTC) para incluir o dia inteiro. Mesma convenção do
 * FinancialService.
 */
function dateRange(from?: string, to?: string) {
  const gte = toDate(from);
  const lte = toDate(to);
  if (lte && to && to.length <= 10) lte.setUTCHours(23, 59, 59, 999);
  const range = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
  return { range, gte, lte, hasRange: Boolean(gte || lte) };
}

/** "YYYY-MM" (UTC) de uma data — usado para agrupar por mês. */
function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** "YYYY-MM-DD" (UTC) de uma data — usado para agrupar por dia. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /reports/overview?from&to — ranking-style aggregations from real tables.
  async overview(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = dateRange(from, to);
    const dateWhere = hasRange ? { date: range } : {};
    const startWhere = hasRange ? { start: range } : {};

    const finishedOrders = await this.prisma.client.order.findMany({
      where: { companyId, status: 'finished', ...dateWhere },
      select: {
        id: true,
        date: true,
        netTotal: true,
        items: {
          select: { kind: true, refId: true, professionalId: true, grossValue: true },
        },
        payments: {
          select: { amount: true, paymentMethodId: true },
        },
      },
    });

    // ----- vendas por dia (series) -----
    const salesByDayMap = new Map<string, number>();
    for (const o of finishedOrders) {
      const day = o.date.toISOString().slice(0, 10);
      salesByDayMap.set(day, (salesByDayMap.get(day) ?? 0) + Number(o.netTotal));
    }
    const salesByDay = Array.from(salesByDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }));

    const salesTotal = finishedOrders.reduce((acc, o) => acc + Number(o.netTotal), 0);

    // ----- aggregate order items -----
    const serviceCount = new Map<string, number>();
    const serviceRevenue = new Map<string, number>();
    const productCount = new Map<string, number>();
    const productRevenue = new Map<string, number>();
    const professionalRevenue = new Map<string, number>();
    const paymentTotals = new Map<string, number>();

    for (const o of finishedOrders) {
      for (const it of o.items) {
        const value = Number(it.grossValue);
        if (it.kind === 'service') {
          serviceCount.set(it.refId, (serviceCount.get(it.refId) ?? 0) + 1);
          serviceRevenue.set(it.refId, (serviceRevenue.get(it.refId) ?? 0) + value);
        } else if (it.kind === 'product') {
          productCount.set(it.refId, (productCount.get(it.refId) ?? 0) + 1);
          productRevenue.set(it.refId, (productRevenue.get(it.refId) ?? 0) + value);
        }
        if (it.professionalId) {
          professionalRevenue.set(
            it.professionalId,
            (professionalRevenue.get(it.professionalId) ?? 0) + value,
          );
        }
      }
      for (const p of o.payments) {
        const key = p.paymentMethodId ?? '__none__';
        paymentTotals.set(key, (paymentTotals.get(key) ?? 0) + Number(p.amount));
      }
    }

    // Resolve names for the ranked ids.
    const serviceIds = Array.from(serviceCount.keys());
    const productIds = Array.from(productCount.keys());
    const professionalIds = Array.from(professionalRevenue.keys());
    const paymentMethodIds = Array.from(paymentTotals.keys()).filter((k) => k !== '__none__');

    const [services, products, professionals, paymentMethods] = await Promise.all([
      serviceIds.length
        ? this.prisma.client.service.findMany({
            where: { id: { in: serviceIds }, companyId },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      productIds.length
        ? this.prisma.client.product.findMany({
            where: { id: { in: productIds }, companyId },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      professionalIds.length
        ? this.prisma.client.professional.findMany({
            where: { id: { in: professionalIds }, companyId },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      paymentMethodIds.length
        ? this.prisma.client.paymentMethod.findMany({
            where: { id: { in: paymentMethodIds }, companyId },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const serviceName = new Map<string, string>(
      services.map((s) => [s.id, s.name] as [string, string]),
    );
    const productName = new Map<string, string>(
      products.map((p) => [p.id, p.name] as [string, string]),
    );
    const professionalName = new Map<string, string>(
      professionals.map((p) => [p.id, p.name] as [string, string]),
    );
    const paymentName = new Map<string, string>(
      paymentMethods.map((p) => [p.id, p.name] as [string, string]),
    );

    const topServices = Array.from(serviceCount.entries())
      .map(([id, count]) => ({
        id,
        name: serviceName.get(id) ?? 'Serviço removido',
        count,
        total: serviceRevenue.get(id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topProducts = Array.from(productCount.entries())
      .map(([id, count]) => ({
        id,
        name: productName.get(id) ?? 'Produto removido',
        count,
        total: productRevenue.get(id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topProfessionals = Array.from(professionalRevenue.entries())
      .map(([id, total]) => ({
        id,
        name: professionalName.get(id) ?? 'Profissional removido',
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const paymentsByMethod = Array.from(paymentTotals.entries())
      .map(([id, total]) => ({
        paymentMethodId: id === '__none__' ? null : id,
        name: id === '__none__' ? 'Sem forma' : (paymentName.get(id) ?? 'Forma removida'),
        total,
      }))
      .sort((a, b) => b.total - a.total);

    // ----- ocupação da agenda -----
    const [appointmentsTotal, appointmentsDone] = await Promise.all([
      this.prisma.client.appointment.count({
        where: { companyId, ...startWhere },
      }),
      this.prisma.client.appointment.count({
        where: { companyId, status: { in: ['done', 'finished'] }, ...startWhere },
      }),
    ]);
    const canceledAppointments = await this.prisma.client.appointment.count({
      where: { companyId, status: 'canceled', ...startWhere },
    });
    const occupancyRate =
      appointmentsTotal > 0 ? appointmentsDone / appointmentsTotal : 0;

    // ----- novos clientes no período -----
    const newCustomers = await this.prisma.client.customer.findMany({
      where: { companyId, ...(hasRange ? { createdAt: range } : {}) },
      select: { id: true, name: true, phone: true, email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const newCustomersCount = await this.prisma.client.customer.count({
      where: { companyId, ...(hasRange ? { createdAt: range } : {}) },
    });

    // ----- aniversariantes do mês -----
    // Birthday month derived from the `to` (or now) reference.
    const ref = to ? new Date(to) : new Date();
    const month = ref.getMonth() + 1; // 1-12
    const withBirthday = await this.prisma.client.customer.findMany({
      where: { companyId, active: true, birthday: { not: null } },
      select: { id: true, name: true, phone: true, birthday: true },
    });
    const birthdays = withBirthday
      .filter((c) => c.birthday && c.birthday.getMonth() + 1 === month)
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        day: c.birthday ? c.birthday.getDate() : null,
      }))
      .sort((a, b) => (a.day ?? 0) - (b.day ?? 0));

    return {
      period: { from: from ?? null, to: to ?? null },
      salesTotal,
      ordersCount: finishedOrders.length,
      salesByDay,
      topServices,
      topProducts,
      topProfessionals,
      paymentsByMethod,
      occupancy: {
        total: appointmentsTotal,
        done: appointmentsDone,
        canceled: canceledAppointments,
        rate: occupancyRate,
      },
      newCustomers,
      newCustomersCount,
      birthdaysMonth: month,
      birthdays,
    };
  }

  // GET /reports/dre?from&to — Demonstrativo de Resultado (regime de caixa:
  // transações liquidadas/paid no período, agrupadas por FinancialCategory).
  async dre(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = dateRange(from, to);
    const paidWhere = hasRange ? { paidAt: range } : {};
    const orderDateWhere = hasRange ? { date: range } : {};

    const [grouped, orders] = await Promise.all([
      this.prisma.client.transaction.groupBy({
        by: ['categoryId', 'kind'],
        _sum: { grossAmount: true },
        where: { companyId, status: 'paid', ...paidWhere },
      }),
      this.prisma.client.order.findMany({
        where: { companyId, status: 'finished', ...orderDateWhere },
        select: {
          netTotal: true,
          items: { select: { kind: true, grossValue: true } },
        },
      }),
    ]);

    const categoryIds = Array.from(
      new Set(
        grouped
          .map((g) => g.categoryId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const categories = categoryIds.length
      ? await this.prisma.client.financialCategory.findMany({
          where: { id: { in: categoryIds }, companyId },
          select: { id: true, name: true },
        })
      : [];
    const categoryName = new Map<string, string>(
      categories.map((c) => [c.id, c.name] as [string, string]),
    );

    const linhas: Array<{
      categoria: string;
      tipo: 'receita' | 'despesa';
      valor: number;
    }> = [];
    let totalReceitas = 0;
    let totalDespesas = 0;

    for (const g of grouped) {
      const valor = Number(g._sum.grossAmount ?? 0);
      const categoria = g.categoryId
        ? (categoryName.get(g.categoryId) ?? 'Sem categoria')
        : 'Sem categoria';
      if (g.kind === 'income') {
        totalReceitas += valor;
        linhas.push({ categoria, tipo: 'receita', valor });
      } else {
        totalDespesas += valor;
        linhas.push({ categoria, tipo: 'despesa', valor });
      }
    }

    linhas.sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === 'receita' ? -1 : 1;
      return b.valor - a.valor;
    });

    const resultado = totalReceitas - totalDespesas;

    // Receita de comandas (Order.netTotal finished) e serviços vs produtos.
    let receitaComandas = 0;
    let receitaServicos = 0;
    let receitaProdutos = 0;
    for (const o of orders) {
      receitaComandas += Number(o.netTotal);
      for (const it of o.items) {
        const value = Number(it.grossValue);
        if (it.kind === 'service') receitaServicos += value;
        else if (it.kind === 'product') receitaProdutos += value;
      }
    }

    return {
      period: { from: from ?? null, to: to ?? null },
      linhas,
      receitas: {
        linhas: linhas.filter((l) => l.tipo === 'receita'),
        total: totalReceitas,
      },
      despesas: {
        linhas: linhas.filter((l) => l.tipo === 'despesa'),
        total: totalDespesas,
      },
      totalReceitas,
      totalDespesas,
      resultado,
      comandas: {
        ordersCount: orders.length,
        receitaComandas,
        receitaServicos,
        receitaProdutos,
      },
    };
  }

  // GET /reports/inventory-suggestion — produtos com stock <= minStock
  // (minStock definido) — sugestão de compra.
  async inventorySuggestion(companyId: string) {
    const products = await this.prisma.client.product.findMany({
      where: {
        companyId,
        active: true,
        deletedAt: null,
        minStock: { gt: 0 },
      },
      select: { id: true, name: true, stock: true, minStock: true },
      orderBy: { name: 'asc' },
    });

    const items = products
      .map((p) => {
        const stock = Number(p.stock);
        const minStock = Number(p.minStock);
        return {
          productId: p.id,
          name: p.name,
          stock,
          minStock,
          deficit: Math.max(0, minStock - stock),
        };
      })
      .filter((p) => p.stock <= p.minStock)
      .sort((a, b) => b.deficit - a.deficit);

    return {
      count: items.length,
      items,
    };
  }

  // GET /reports/messages?from&to — mensagens enviadas por canal e por tipo.
  // Fontes: WhatsappOutbox (agora company-scoped via companyId), CampaignMessage
  // (via Campaign.channel) e AppointmentNotification/Notification (por tipo).
  async messages(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = dateRange(from, to);
    const sentWhere = hasRange ? { sentAt: range } : {};
    const createdWhere = hasRange ? { createdAt: range } : {};

    const [
      whatsappOutboxSent,
      campaignGrouped,
      apptNotifications,
      notifications,
    ] = await Promise.all([
      // WhatsappOutbox agora tem companyId — conta só os desta empresa. Registros
      // antigos sem companyId ficam de fora do agregado (contagem honesta por tenant).
      this.prisma.client.whatsappOutbox.count({
        where: { companyId, status: 'sent', ...(hasRange ? { sentAt: range } : {}) },
      }),
      this.prisma.client.campaignMessage.findMany({
        where: {
          status: 'sent',
          campaign: { companyId },
          ...(hasRange ? { sentAt: range } : {}),
        },
        select: { campaign: { select: { channel: true } } },
      }),
      this.prisma.client.appointmentNotification.findMany({
        where: {
          appointment: { companyId },
          sentAt: { not: null },
          ...sentWhere,
        },
        select: { channel: true, type: true },
      }),
      this.prisma.client.notification.findMany({
        where: { companyId, ...createdWhere },
        select: { type: true },
      }),
    ]);

    // ----- por canal -----
    const channelCounts = new Map<string, number>();
    const addChannel = (channel: string, n = 1) =>
      channelCounts.set(channel, (channelCounts.get(channel) ?? 0) + n);

    addChannel('whatsapp', whatsappOutboxSent);
    for (const m of campaignGrouped) {
      addChannel(m.campaign.channel);
    }
    for (const n of apptNotifications) {
      addChannel(n.channel);
    }

    const channelLabels: Record<string, string> = {
      whatsapp: 'WhatsApp',
      sms: 'SMS',
      email: 'E-mail',
      push: 'Push',
    };
    // Garante linhas honestas (0) para os canais principais solicitados.
    for (const key of ['whatsapp', 'sms']) {
      if (!channelCounts.has(key)) channelCounts.set(key, 0);
    }
    const byChannel = Array.from(channelCounts.entries())
      .map(([channel, count]) => ({
        channel,
        label: channelLabels[channel] ?? channel,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // ----- por tipo (lembrete / felicitação / outros) -----
    const classify = (
      raw: string,
    ): 'lembrete' | 'felicitacao' | 'outros' => {
      const t = raw.toLowerCase();
      if (
        t.includes('reminder') ||
        t.includes('lembrete') ||
        t.includes('confirm')
      ) {
        return 'lembrete';
      }
      if (
        t.includes('birthday') ||
        t.includes('aniversar') ||
        t.includes('felicit') ||
        t.includes('parab')
      ) {
        return 'felicitacao';
      }
      return 'outros';
    };

    const typeCounts = new Map<string, number>([
      ['lembrete', 0],
      ['felicitacao', 0],
      ['outros', 0],
    ]);
    const addType = (raw: string) => {
      const k = classify(raw);
      typeCounts.set(k, (typeCounts.get(k) ?? 0) + 1);
    };
    for (const n of apptNotifications) addType(n.type);
    for (const n of notifications) addType(n.type);

    const typeLabels: Record<string, string> = {
      lembrete: 'Lembrete',
      felicitacao: 'Felicitação',
      outros: 'Outros',
    };
    const byType = Array.from(typeCounts.entries()).map(([type, count]) => ({
      type,
      label: typeLabels[type] ?? type,
      count,
    }));

    const totalSent =
      whatsappOutboxSent +
      campaignGrouped.length +
      apptNotifications.length;

    return {
      period: { from: from ?? null, to: to ?? null },
      totalSent,
      byChannel,
      byType,
      sources: {
        whatsappOutbox: whatsappOutboxSent,
        campaignMessages: campaignGrouped.length,
        appointmentNotifications: apptNotifications.length,
        notifications: notifications.length,
      },
    };
  }

  // GET /reports/messages/rows?from&to&status&kind — LINHAS por mensagem do
  // relatório de mensagens (company-scoped). Fonte: WhatsappOutbox onde
  // companyId = empresa ativa OU o telefone casa com o de algum Customer da
  // empresa (registros antigos/sem companyId). Filtros: from/to (por sentAt OU
  // createdAt), status (sent|failed|pending), kind.
  async messagesRows(
    companyId: string,
    opts: {
      from?: string;
      to?: string;
      status?: string;
      kind?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const { from, to, status, kind } = opts;
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 100;
    const offset = opts.offset && opts.offset > 0 ? opts.offset : 0;
    const { range, hasRange } = dateRange(from, to);

    // Telefones dos clientes da empresa → últimos 8 dígitos, p/ casar com o
    // outbox mesmo em registros antigos que não têm companyId gravado.
    const customers = await this.prisma.client.customer.findMany({
      where: { companyId, phone: { not: null } },
      select: { id: true, name: true, phone: true },
    });
    const tailToCustomer = new Map<string, { id: string; name: string }>();
    const phoneTails: string[] = [];
    for (const c of customers) {
      const digits = (c.phone ?? '').replace(/\D/g, '');
      if (digits.length < 8) continue;
      const tail = digits.slice(-8);
      phoneTails.push(tail);
      // Primeiro cliente vence em caso de colisão de tail (raro).
      if (!tailToCustomer.has(tail)) tailToCustomer.set(tail, { id: c.id, name: c.name });
    }

    // Período: casa por sentAt OU createdAt (mensagem pode estar pendente).
    const dateFilter = hasRange
      ? { OR: [{ sentAt: range }, { createdAt: range }] }
      : {};

    const rows = await this.prisma.client.whatsappOutbox.findMany({
      where: {
        AND: [
          {
            OR: [
              { companyId },
              ...(phoneTails.length
                ? phoneTails.map((t) => ({ toPhone: { endsWith: t } }))
                : []),
            ],
          },
          ...(status ? [{ status }] : []),
          ...(kind ? [{ kind }] : []),
          dateFilter,
        ],
      },
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    });

    // Nome do cliente: prioriza customerId direto; senão casa pelo tail do telefone.
    const directIds = Array.from(
      new Set(rows.map((r) => r.customerId).filter((v): v is string => Boolean(v))),
    );
    const directNames = directIds.length
      ? await this.prisma.client.customer.findMany({
          where: { id: { in: directIds }, companyId },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map<string, string>(
      directNames.map((c) => [c.id, c.name] as [string, string]),
    );

    const data = rows.map((r) => {
      const tail = (r.toPhone ?? '').replace(/\D/g, '').slice(-8);
      const customerName =
        (r.customerId ? nameById.get(r.customerId) : undefined) ??
        tailToCustomer.get(tail)?.name ??
        null;
      return {
        id: r.id,
        at: r.sentAt ?? r.createdAt,
        toPhone: r.toPhone,
        customerName,
        kind: r.kind ?? null,
        status: r.status,
        textPreview: r.text.length > 140 ? `${r.text.slice(0, 140)}…` : r.text,
      };
    });

    return {
      period: { from: from ?? null, to: to ?? null },
      rows: data,
      limit,
      offset,
      totals: { count: data.length },
    };
  }

  // GET /reports/birthdays?month — aniversariantes do mês (1-12).

  /**
   * Relatório de CLIENTES — a lista completa, com as colunas que a tela oferece.
   *
   * Existe porque a tela puxava `overview.newCustomers` (clientes NOVOS no
   * período do dashboard) e prometia "a lista completa": num salão que não
   * cadastrou ninguém nos dias escolhidos, a lista vinha vazia e o botão
   * "Gerar relatório" ficava desabilitado — parecia quebrado, e estava.
   *
   * `from`/`to` recortam por data de CRIAÇÃO do cliente, que é o rótulo da tela
   * ("Criado em"). Sem intervalo, traz todos.
   *
   * As contagens e somas saem de `_count` e das relações incluídas no mesmo
   * `findMany` — nunca uma consulta por cliente, senão um salão com 3 mil
   * clientes derruba o relatório.
   */
  async customers(
    companyId: string,
    opts: {
      from?: string;
      to?: string;
      status?: string;
      balance?: string;
      tags?: string;
    },
  ) {
    const from = opts.from ? new Date(opts.from) : undefined;
    const to = opts.to ? new Date(`${opts.to.slice(0, 10)}T23:59:59.999Z`) : undefined;
    const tags = (opts.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const rows = await this.prisma.client.customer.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(opts.status === 'active'
          ? { active: true }
          : opts.status === 'inactive'
            ? { active: false }
            : {}),
        ...(from || to
          ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
        ...(tags.length ? { tags: { some: { name: { in: tags } } } } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        tags: { select: { name: true } },
        credits: { select: { amount: true } },
        customerPackages: { select: { price: true } },
        orders: {
          where: { status: 'finished' },
          select: { netTotal: true },
        },
      },
    });

    const soma = (list: { [k: string]: unknown }[], campo: string) =>
      list.reduce((acc, r) => acc + Number(r[campo] ?? 0), 0);

    const data = rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? null,
      email: c.email ?? null,
      cpf: c.cpf ?? null,
      rg: c.rg ?? null,
      birthday: c.birthday ? c.birthday.toISOString() : null,
      street: c.street ?? null,
      number: c.number ?? null,
      district: c.district ?? null,
      city: c.city ?? null,
      state: c.state ?? null,
      active: c.active,
      createdAt: c.createdAt.toISOString(),
      tags: c.tags.map((t) => t.name),
      creditBalance: soma(c.credits, 'amount'),
      packagesCount: c.customerPackages.length,
      packagesTotal: soma(c.customerPackages, 'price'),
      ordersCount: c.orders.length,
      ordersTotal: soma(c.orders, 'netTotal'),
    }));

    // "Com saldo" é filtro sobre um valor CALCULADO (soma do ledger de crédito),
    // então não dá para expressar no `where` — fica aqui, depois do mapa.
    return opts.balance === 'with_balance'
      ? data.filter((c) => c.creditBalance > 0)
      : data;
  }

  async birthdays(companyId: string, month?: string) {
    const parsed = month ? Number(month) : new Date().getMonth() + 1;
    const targetMonth =
      Number.isInteger(parsed) && parsed >= 1 && parsed <= 12
        ? parsed
        : new Date().getMonth() + 1;

    const customers = await this.prisma.client.customer.findMany({
      where: {
        companyId,
        active: true,
        deletedAt: null,
        birthday: { not: null },
      },
      select: { id: true, name: true, phone: true, birthday: true },
    });

    const list = customers
      .filter((c) => c.birthday && c.birthday.getMonth() + 1 === targetMonth)
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        day: c.birthday ? c.birthday.getDate() : null,
      }))
      .sort((a, b) => (a.day ?? 0) - (b.day ?? 0));

    return {
      month: targetMonth,
      count: list.length,
      customers: list,
    };
  }

  // GET /reports/sales?from&to — vendas por dia + por profissional + por
  // categoria (serviço/produto). Reusa a lógica de comandas do overview.
  async sales(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = dateRange(from, to);
    const dateWhere = hasRange ? { date: range } : {};

    const finishedOrders = await this.prisma.client.order.findMany({
      where: { companyId, status: 'finished', ...dateWhere },
      select: {
        date: true,
        netTotal: true,
        items: {
          select: { kind: true, refId: true, professionalId: true, grossValue: true },
        },
      },
    });

    // ----- por dia -----
    const byDayMap = new Map<string, number>();
    for (const o of finishedOrders) {
      const day = o.date.toISOString().slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + Number(o.netTotal));
    }
    const byDay = Array.from(byDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }));

    const salesTotal = finishedOrders.reduce(
      (acc, o) => acc + Number(o.netTotal),
      0,
    );

    // ----- por profissional & itens por refId/kind -----
    const professionalRevenue = new Map<string, number>();
    const serviceRefRevenue = new Map<string, number>();
    const productRefRevenue = new Map<string, number>();

    for (const o of finishedOrders) {
      for (const it of o.items) {
        const value = Number(it.grossValue);
        if (it.professionalId) {
          professionalRevenue.set(
            it.professionalId,
            (professionalRevenue.get(it.professionalId) ?? 0) + value,
          );
        }
        if (it.kind === 'service') {
          serviceRefRevenue.set(
            it.refId,
            (serviceRefRevenue.get(it.refId) ?? 0) + value,
          );
        } else if (it.kind === 'product') {
          productRefRevenue.set(
            it.refId,
            (productRefRevenue.get(it.refId) ?? 0) + value,
          );
        }
      }
    }

    const professionalIds = Array.from(professionalRevenue.keys());
    const serviceIds = Array.from(serviceRefRevenue.keys());
    const productIds = Array.from(productRefRevenue.keys());

    const [professionals, services, products] = await Promise.all([
      professionalIds.length
        ? this.prisma.client.professional.findMany({
            where: { id: { in: professionalIds }, companyId },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      serviceIds.length
        ? this.prisma.client.service.findMany({
            where: { id: { in: serviceIds }, companyId },
            select: { id: true, categoryId: true, category: { select: { name: true } } },
          })
        : Promise.resolve([]),
      productIds.length
        ? this.prisma.client.product.findMany({
            where: { id: { in: productIds }, companyId },
            select: { id: true, categoryId: true, category: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);

    const professionalName = new Map<string, string>(
      professionals.map((p) => [p.id, p.name] as [string, string]),
    );
    const byProfessional = Array.from(professionalRevenue.entries())
      .map(([id, total]) => ({
        id,
        name: professionalName.get(id) ?? 'Profissional removido',
        total,
      }))
      .sort((a, b) => b.total - a.total);

    // ----- por categoria (agrega serviço + produto por nome de categoria) -----
    const categoryRevenue = new Map<string, number>();
    const addCategory = (name: string, value: number) =>
      categoryRevenue.set(name, (categoryRevenue.get(name) ?? 0) + value);

    const serviceCategory = new Map<string, string>(
      services.map(
        (s) =>
          [s.id, s.category?.name ?? 'Sem categoria'] as [string, string],
      ),
    );
    const productCategory = new Map<string, string>(
      products.map(
        (p) =>
          [p.id, p.category?.name ?? 'Sem categoria'] as [string, string],
      ),
    );

    for (const [refId, value] of serviceRefRevenue.entries()) {
      addCategory(serviceCategory.get(refId) ?? 'Sem categoria', value);
    }
    for (const [refId, value] of productRefRevenue.entries()) {
      addCategory(productCategory.get(refId) ?? 'Sem categoria', value);
    }

    const byCategory = Array.from(categoryRevenue.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    return {
      period: { from: from ?? null, to: to ?? null },
      salesTotal,
      ordersCount: finishedOrders.length,
      byDay,
      byProfessional,
      byCategory,
    };
  }

  // ==================================================================
  // FINANCEIRO — sobre Order/OrderItem/Transaction (sem migration)
  // ==================================================================

  // GET /reports/service-revenue?from&to — resultado líquido por SERVIÇO
  // (OrderItem kind=service em comandas finalizadas): qtd, bruto, desconto, líquido.
  serviceRevenue(companyId: string, from?: string, to?: string) {
    return this.itemRevenue(companyId, 'service', from, to);
  }

  // GET /reports/product-revenue?from&to — idem para PRODUTO (OrderItem kind=product).
  productRevenue(companyId: string, from?: string, to?: string) {
    return this.itemRevenue(companyId, 'product', from, to);
  }

  private async itemRevenue(
    companyId: string,
    kind: 'service' | 'product',
    from?: string,
    to?: string,
  ) {
    const { range, hasRange } = dateRange(from, to);
    const dateWhere = hasRange ? { date: range } : {};

    const orders = await this.prisma.client.order.findMany({
      where: { companyId, status: 'finished', ...dateWhere },
      select: {
        items: {
          where: { kind },
          select: { refId: true, quantity: true, grossValue: true, discount: true },
        },
      },
    });

    const agg = new Map<
      string,
      { qtd: number; bruto: number; desconto: number }
    >();
    for (const o of orders) {
      for (const it of o.items) {
        const cur = agg.get(it.refId) ?? { qtd: 0, bruto: 0, desconto: 0 };
        cur.qtd += Number(it.quantity);
        cur.bruto += Number(it.grossValue);
        cur.desconto += Number(it.discount);
        agg.set(it.refId, cur);
      }
    }

    const ids = Array.from(agg.keys());
    const named = ids.length
      ? kind === 'service'
        ? await this.prisma.client.service.findMany({
            where: { id: { in: ids }, companyId },
            select: { id: true, name: true },
          })
        : await this.prisma.client.product.findMany({
            where: { id: { in: ids }, companyId },
            select: { id: true, name: true },
          })
      : [];
    const nameById = new Map<string, string>(
      named.map((n) => [n.id, n.name] as [string, string]),
    );

    const removedLabel = kind === 'service' ? 'Serviço removido' : 'Produto removido';
    const idKey = kind === 'service' ? 'serviceId' : 'productId';
    const rows = Array.from(agg.entries())
      .map(([id, v]) => ({
        [idKey]: id,
        name: nameById.get(id) ?? removedLabel,
        qtd: v.qtd,
        bruto: v.bruto,
        desconto: v.desconto,
        liquido: v.bruto - v.desconto,
      }))
      .sort((a, b) => b.liquido - a.liquido);

    const totals = rows.reduce(
      (acc, r) => {
        acc.qtd += r.qtd;
        acc.bruto += r.bruto;
        acc.desconto += r.desconto;
        acc.liquido += r.liquido;
        return acc;
      },
      { qtd: 0, bruto: 0, desconto: 0, liquido: 0 },
    );

    return { period: { from: from ?? null, to: to ?? null }, rows, totals };
  }

  // GET /reports/billing-projection — projeção de contas a receber futuras
  // (Transaction income pendente com dueDate > hoje) agrupado por mês.
  async billingProjection(companyId: string) {
    const now = new Date();
    const txs = await this.prisma.client.transaction.findMany({
      where: {
        companyId,
        kind: 'income',
        status: 'pending',
        dueDate: { gt: now },
      },
      select: { dueDate: true, grossAmount: true },
    });

    const byMonth = new Map<string, { total: number; count: number }>();
    for (const t of txs) {
      if (!t.dueDate) continue;
      const k = monthKey(t.dueDate);
      const cur = byMonth.get(k) ?? { total: 0, count: 0 };
      cur.total += Number(t.grossAmount);
      cur.count += 1;
      byMonth.set(k, cur);
    }

    const rows = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, total: v.total, count: v.count }));

    const totals = rows.reduce(
      (acc, r) => {
        acc.total += r.total;
        acc.count += r.count;
        return acc;
      },
      { total: 0, count: 0 },
    );

    return { asOf: now.toISOString(), rows, totals };
  }

  // GET /reports/receivables?from&to — Recebimentos (Transaction income) no
  // período por status. Regime: pagos por paidAt, pendentes por dueDate.
  async receivables(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = dateRange(from, to);
    const txs = await this.prisma.client.transaction.findMany({
      where: {
        companyId,
        kind: 'income',
        ...(hasRange ? { OR: [{ paidAt: range }, { dueDate: range }] } : {}),
      },
      select: { status: true, grossAmount: true },
    });

    const byStatus = new Map<string, { total: number; count: number }>([
      ['paid', { total: 0, count: 0 }],
      ['pending', { total: 0, count: 0 }],
    ]);
    for (const t of txs) {
      const cur = byStatus.get(t.status) ?? { total: 0, count: 0 };
      cur.total += Number(t.grossAmount);
      cur.count += 1;
      byStatus.set(t.status, cur);
    }

    const statusLabels: Record<string, string> = {
      paid: 'Pago',
      pending: 'Pendente',
      reversed: 'Estornado',
    };
    const rows = Array.from(byStatus.entries()).map(([status, v]) => ({
      status,
      label: statusLabels[status] ?? status,
      total: v.total,
      count: v.count,
    }));

    const paid = byStatus.get('paid') ?? { total: 0, count: 0 };
    const pending = byStatus.get('pending') ?? { total: 0, count: 0 };
    const totals = {
      total: rows.reduce((a, r) => a + r.total, 0),
      count: rows.reduce((a, r) => a + r.count, 0),
      paid: paid.total,
      pending: pending.total,
    };

    return { period: { from: from ?? null, to: to ?? null }, rows, totals };
  }

  // GET /reports/expenses?from&to — Despesas (Transaction expense) no período
  // por categoria financeira. Considera período por paidAt OU dueDate.
  async expenses(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = dateRange(from, to);
    const txs = await this.prisma.client.transaction.findMany({
      where: {
        companyId,
        kind: 'expense',
        ...(hasRange ? { OR: [{ paidAt: range }, { dueDate: range }] } : {}),
      },
      select: { categoryId: true, status: true, grossAmount: true },
    });

    const agg = new Map<
      string,
      { total: number; count: number; paid: number; pending: number }
    >();
    for (const t of txs) {
      const key = t.categoryId ?? '__none__';
      const cur = agg.get(key) ?? { total: 0, count: 0, paid: 0, pending: 0 };
      const v = Number(t.grossAmount);
      cur.total += v;
      cur.count += 1;
      if (t.status === 'paid') cur.paid += v;
      else if (t.status === 'pending') cur.pending += v;
      agg.set(key, cur);
    }

    const categoryIds = Array.from(agg.keys()).filter((k) => k !== '__none__');
    const categories = categoryIds.length
      ? await this.prisma.client.financialCategory.findMany({
          where: { id: { in: categoryIds }, companyId },
          select: { id: true, name: true },
        })
      : [];
    const categoryName = new Map<string, string>(
      categories.map((c) => [c.id, c.name] as [string, string]),
    );

    const rows = Array.from(agg.entries())
      .map(([id, v]) => ({
        categoryId: id === '__none__' ? null : id,
        category:
          id === '__none__' ? 'Sem categoria' : (categoryName.get(id) ?? 'Categoria removida'),
        total: v.total,
        count: v.count,
        paid: v.paid,
        pending: v.pending,
      }))
      .sort((a, b) => b.total - a.total);

    const totals = rows.reduce(
      (acc, r) => {
        acc.total += r.total;
        acc.count += r.count;
        acc.paid += r.paid;
        acc.pending += r.pending;
        return acc;
      },
      { total: 0, count: 0, paid: 0, pending: 0 },
    );

    return { period: { from: from ?? null, to: to ?? null }, rows, totals };
  }

  // ==================================================================
  // AGENDA — sobre Appointment (sem migration)
  // ==================================================================

  // GET /reports/appointments-deleted?from&to — agendamentos cancelados no
  // período (Appointment.status=canceled, filtrado por start).
  async appointmentsDeleted(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = dateRange(from, to);
    const appts = await this.prisma.client.appointment.findMany({
      where: {
        companyId,
        status: 'canceled',
        ...(hasRange ? { start: range } : {}),
      },
      select: {
        id: true,
        start: true,
        end: true,
        notes: true,
        updatedAt: true,
        customer: { select: { name: true } },
        professional: { select: { name: true } },
      },
      orderBy: { start: 'desc' },
    });

    const rows = appts.map((a) => ({
      id: a.id,
      start: a.start,
      end: a.end,
      customer: a.customer?.name ?? null,
      professional: a.professional?.name ?? null,
      notes: a.notes,
      canceledAt: a.updatedAt,
    }));

    return {
      period: { from: from ?? null, to: to ?? null },
      rows,
      totals: { count: rows.length },
    };
  }

  // GET /reports/appointments-origin?from&to — contagem por origem/canal
  // (Appointment.source: admin | online), filtrado por start.
  async appointmentsOrigin(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = dateRange(from, to);
    const grouped = await this.prisma.client.appointment.groupBy({
      by: ['source'],
      _count: { _all: true },
      where: { companyId, ...(hasRange ? { start: range } : {}) },
    });

    const sourceLabels: Record<string, string> = {
      admin: 'Administrativo',
      online: 'Online',
    };
    const rows = grouped
      .map((g) => ({
        source: g.source,
        label: sourceLabels[g.source] ?? g.source,
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      period: { from: from ?? null, to: to ?? null },
      rows,
      totals: { count: rows.reduce((a, r) => a + r.count, 0) },
    };
  }

  // GET /reports/appointments-creation?from&to — agendamentos criados por dia
  // no período (Appointment.createdAt).
  async appointmentsCreation(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = dateRange(from, to);
    const appts = await this.prisma.client.appointment.findMany({
      where: { companyId, ...(hasRange ? { createdAt: range } : {}) },
      select: { createdAt: true },
    });

    const byDay = new Map<string, number>();
    for (const a of appts) {
      const k = dayKey(a.createdAt);
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }
    const rows = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return {
      period: { from: from ?? null, to: to ?? null },
      rows,
      totals: { count: appts.length },
    };
  }

  // GET /reports/care-today — "cuidados para hoje": agendamentos de hoje (lista).
  async careToday(companyId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const appts = await this.prisma.client.appointment.findMany({
      where: {
        companyId,
        start: { gte: todayStart, lte: todayEnd },
        status: { not: 'canceled' },
      },
      select: {
        id: true,
        start: true,
        end: true,
        status: true,
        notes: true,
        customer: { select: { name: true, phone: true } },
        professional: { select: { name: true } },
        items: { select: { service: { select: { name: true } } } },
      },
      orderBy: { start: 'asc' },
    });

    const rows = appts.map((a) => ({
      id: a.id,
      start: a.start,
      end: a.end,
      status: a.status,
      customer: a.customer?.name ?? null,
      phone: a.customer?.phone ?? null,
      professional: a.professional?.name ?? null,
      services: a.items.map((it) => it.service?.name).filter(Boolean),
      notes: a.notes,
    }));

    return {
      date: dayKey(todayStart),
      rows,
      totals: { count: rows.length },
    };
  }

  // ==================================================================
  // ESTOQUE — InventoryMovement / OrderItemConsumedProduct / Purchase
  // ==================================================================

  // GET /reports/inventory-movements?from&to — movimentos de estoque no período
  // (InventoryMovement.createdAt) por produto: entradas/saídas/ajustes.
  async inventoryMovements(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = dateRange(from, to);
    const movements = await this.prisma.client.inventoryMovement.findMany({
      where: {
        product: { companyId },
        ...(hasRange ? { createdAt: range } : {}),
      },
      select: {
        productId: true,
        type: true,
        quantity: true,
        product: { select: { name: true } },
      },
    });

    const agg = new Map<
      string,
      { name: string; in: number; out: number; adjust: number }
    >();
    for (const m of movements) {
      const cur =
        agg.get(m.productId) ??
        { name: m.product?.name ?? 'Produto removido', in: 0, out: 0, adjust: 0 };
      const q = Number(m.quantity);
      if (m.type === 'in') cur.in += q;
      else if (m.type === 'out') cur.out += q;
      else cur.adjust += q;
      agg.set(m.productId, cur);
    }

    const rows = Array.from(agg.entries())
      .map(([productId, v]) => ({
        productId,
        name: v.name,
        in: v.in,
        out: v.out,
        adjust: v.adjust,
        net: v.in - v.out + v.adjust,
      }))
      .sort((a, b) => b.out - a.out);

    const totals = rows.reduce(
      (acc, r) => {
        acc.in += r.in;
        acc.out += r.out;
        acc.adjust += r.adjust;
        return acc;
      },
      { in: 0, out: 0, adjust: 0, count: movements.length },
    );

    return { period: { from: from ?? null, to: to ?? null }, rows, totals };
  }

  // GET /reports/purchases?from&to — compras no período (Purchase.date) por
  // fornecedor: total e contagem de notas.
  async purchases(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = dateRange(from, to);
    const purchases = await this.prisma.client.purchase.findMany({
      where: { companyId, ...(hasRange ? { date: range } : {}) },
      select: {
        supplierId: true,
        total: true,
        supplier: { select: { name: true } },
      },
    });

    const agg = new Map<
      string,
      { name: string; total: number; count: number }
    >();
    for (const p of purchases) {
      const key = p.supplierId ?? '__none__';
      const cur =
        agg.get(key) ??
        { name: p.supplier?.name ?? 'Sem fornecedor', total: 0, count: 0 };
      cur.total += Number(p.total);
      cur.count += 1;
      agg.set(key, cur);
    }

    const rows = Array.from(agg.entries())
      .map(([supplierId, v]) => ({
        supplierId: supplierId === '__none__' ? null : supplierId,
        supplier: v.name,
        total: v.total,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total);

    const totals = {
      total: rows.reduce((a, r) => a + r.total, 0),
      count: purchases.length,
    };

    return { period: { from: from ?? null, to: to ?? null }, rows, totals };
  }

  // GET /reports/consumed-products?from&to — produtos consumidos em serviços no
  // período (OrderItemConsumedProduct.createdAt) por produto: qtd e custo.
  async consumedProducts(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = dateRange(from, to);
    const consumed = await this.prisma.client.orderItemConsumedProduct.findMany({
      where: {
        product: { companyId },
        ...(hasRange ? { createdAt: range } : {}),
      },
      select: {
        productId: true,
        quantity: true,
        extraQuantity: true,
        unitValue: true,
        product: { select: { name: true } },
      },
    });

    const agg = new Map<
      string,
      { name: string; qtd: number; custo: number }
    >();
    for (const c of consumed) {
      const cur =
        agg.get(c.productId) ??
        { name: c.product?.name ?? 'Produto removido', qtd: 0, custo: 0 };
      const qtd = Number(c.quantity) + Number(c.extraQuantity);
      cur.qtd += qtd;
      cur.custo += qtd * Number(c.unitValue);
      agg.set(c.productId, cur);
    }

    const rows = Array.from(agg.entries())
      .map(([productId, v]) => ({
        productId,
        name: v.name,
        qtd: v.qtd,
        custo: v.custo,
      }))
      .sort((a, b) => b.custo - a.custo);

    const totals = rows.reduce(
      (acc, r) => {
        acc.qtd += r.qtd;
        acc.custo += r.custo;
        return acc;
      },
      { qtd: 0, custo: 0, count: consumed.length },
    );

    return { period: { from: from ?? null, to: to ?? null }, rows, totals };
  }
}
