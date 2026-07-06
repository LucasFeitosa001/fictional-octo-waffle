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
}
