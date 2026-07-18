import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function buildRange(from?: string, to?: string) {
  const range = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };
  const hasRange = Boolean(from || to);
  return { range, hasRange };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /reports/overview?from&to — ranking-style aggregations from real tables.
  async overview(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = buildRange(from, to);
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
    const { range, hasRange } = buildRange(from, to);
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
  // Fontes: WhatsappOutbox (global — sem companyId no schema), CampaignMessage
  // (via Campaign.channel) e AppointmentNotification/Notification (por tipo).
  async messages(companyId: string, from?: string, to?: string) {
    const { range, hasRange } = buildRange(from, to);
    const sentWhere = hasRange ? { sentAt: range } : {};
    const createdWhere = hasRange ? { createdAt: range } : {};

    const [
      whatsappOutboxSent,
      campaignGrouped,
      apptNotifications,
      notifications,
    ] = await Promise.all([
      // WhatsappOutbox não possui companyId no schema — contagem global honesta.
      this.prisma.client.whatsappOutbox.count({
        where: { status: 'sent', ...(hasRange ? { sentAt: range } : {}) },
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

  // GET /reports/birthdays?month — aniversariantes do mês (1-12).
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
    const { range, hasRange } = buildRange(from, to);
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
}
