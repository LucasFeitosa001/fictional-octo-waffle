import { Injectable } from '@nestjs/common';
import { AppointmentStatus, OrderStatus } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { computeFunnel } from './dashboard.util';

// Appointment statuses that represent an appointment which still occupies the
// agenda (everything except an explicit cancellation).
const NON_CANCELED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.scheduled,
  AppointmentStatus.confirmed,
  AppointmentStatus.unconfirmed,
  AppointmentStatus.waiting,
  AppointmentStatus.in_progress,
  AppointmentStatus.done,
  AppointmentStatus.finished,
];

// Statuses that count as "confirmed" for the conversion funnel (confirmed and
// everything downstream of it).
// (a lista de status "confirmado em diante" do funil vive em dashboard.util.ts,
//  junto do computeFunnel que a consome)

// Heat-map hour window (business hours) — rows 8h..19h inclusive.
const HEAT_HOUR_START = 8;
const HEAT_HOUR_END = 19;

interface DayBucket {
  agendamentos: number;
  comandas: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // GET /dashboard?from&to — full panel aggregation (all widgets).
  // Every metric is computed for the [from,to] window (inclusive days, company
  // timezone) and compared against the immediately-preceding window of the same
  // length. Money is returned as plain BRL numbers (Decimal -> Number).
  // ---------------------------------------------------------------------------
  async overview(companyId: string, from?: string, to?: string) {
    const tz = await this.companyTimezone(companyId);

    // Resolve the requested window into calendar days (defaults to last 30 days).
    const todayStr = this.dayInTz(new Date(), tz);
    const toDay = this.parseDay(to) ?? todayStr;
    const fromDay = this.parseDay(from) ?? this.addDays(toDay, -29, tz);

    // Instants bounding the current window: [startI, endI) — endI is the start of
    // the day AFTER `toDay`, so the whole `toDay` is included.
    const startI = this.zonedWallClockToUtc(fromDay, '00:00', tz);
    const endI = this.zonedWallClockToUtc(this.addDays(toDay, 1, tz), '00:00', tz);

    // Previous window of identical length, immediately before the current one.
    const durationMs = endI.getTime() - startI.getTime();
    const prevEndI = startI;
    const prevStartI = new Date(startI.getTime() - durationMs);

    // Today's window (for the "vendas do dia" tile) — independent of the range.
    const todayStartI = this.zonedWallClockToUtc(todayStr, '00:00', tz);
    const todayEndI = this.zonedWallClockToUtc(this.addDays(todayStr, 1, tz), '00:00', tz);

    const [
      professionals,
      orders,
      prevFinishedOrders,
      todayFinishedOrders,
      appointments,
      prevAppointmentsCount,
    ] = await Promise.all([
      this.prisma.client.professional.findMany({
        where: { companyId, deletedAt: null },
        select: {
          id: true,
          name: true,
          schedules: { select: { weekday: true, startTime: true, endTime: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.order.findMany({
        where: { companyId, date: { gte: startI, lt: endI } },
        select: {
          id: true,
          status: true,
          netTotal: true,
          date: true,
          professionalId: true,
          // customerId alimenta o funil (ver computeFunnel).
          customerId: true,
          items: {
            select: {
              kind: true,
              refId: true,
              professionalId: true,
              grossValue: true,
              discount: true,
              quantity: true,
            },
          },
        },
      }),
      this.prisma.client.order.findMany({
        where: { companyId, status: OrderStatus.finished, date: { gte: prevStartI, lt: prevEndI } },
        select: { netTotal: true },
      }),
      this.prisma.client.order.findMany({
        where: { companyId, status: OrderStatus.finished, date: { gte: todayStartI, lt: todayEndI } },
        select: { netTotal: true },
      }),
      this.prisma.client.appointment.findMany({
        where: { companyId, start: { gte: startI, lt: endI } },
        // customerId alimenta o funil (casa agendamento ↔ comanda do mesmo cliente).
        select: {
          id: true,
          status: true,
          start: true,
          end: true,
          professionalId: true,
          customerId: true,
        },
      }),
      this.prisma.client.appointment.count({
        where: { companyId, start: { gte: prevStartI, lt: prevEndI } },
      }),
    ]);

    const finishedOrders = orders.filter((o) => o.status === OrderStatus.finished);
    const comandas = orders.filter((o) => o.status !== OrderStatus.canceled);

    // Resolve category names for every service/product referenced by finished
    // order items (needed by vendasPorCategoria).
    const serviceRefIds = [
      ...new Set(
        finishedOrders.flatMap((o) => o.items.filter((i) => i.kind === 'service').map((i) => i.refId)),
      ),
    ];
    const productRefIds = [
      ...new Set(
        finishedOrders.flatMap((o) => o.items.filter((i) => i.kind === 'product').map((i) => i.refId)),
      ),
    ];
    const [services, products] = await Promise.all([
      serviceRefIds.length
        ? this.prisma.client.service.findMany({
            where: { companyId, id: { in: serviceRefIds } },
            select: { id: true, category: { select: { name: true } } },
          })
        : Promise.resolve([]),
      productRefIds.length
        ? this.prisma.client.product.findMany({
            where: { companyId, id: { in: productRefIds } },
            select: { id: true, category: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);
    const serviceCategory = new Map<string, string | null>(
      services.map((s): [string, string | null] => [s.id, s.category?.name ?? null]),
    );
    const productCategory = new Map<string, string | null>(
      products.map((p): [string, string | null] => [p.id, p.category?.name ?? null]),
    );

    const professionalName = new Map<string, string>(
      professionals.map((p): [string, string] => [p.id, p.name]),
    );

    // ---- 1/8. Vendas totais + comparação de períodos --------------------------
    const vendasTotaisValor = this.sumDecimal(finishedOrders.map((o) => o.netTotal));
    const prevVendas = this.sumDecimal(prevFinishedOrders.map((o) => o.netTotal));

    // ---- 2. Vendas do dia -----------------------------------------------------
    const vendasDia = this.sumDecimal(todayFinishedOrders.map((o) => o.netTotal));

    // ---- 3. Agendamentos (contagem + crescimento) -----------------------------
    const agendamentosCount = appointments.length;

    // ---- 4. Comandas + taxa de conversão --------------------------------------
    const comandasCount = comandas.length;
    const taxaConversao = this.pct(comandasCount, agendamentosCount);

    // ---- 5. Tendência de visitas (série por dia) ------------------------------
    const dayList = this.dayRange(fromDay, toDay, tz);
    const dayBuckets = new Map<string, DayBucket>(
      dayList.map((d) => [d, { agendamentos: 0, comandas: 0 }]),
    );
    for (const a of appointments) {
      const d = this.dayInTz(a.start, tz);
      const bucket = dayBuckets.get(d);
      if (bucket) bucket.agendamentos += 1;
    }
    for (const o of comandas) {
      const d = this.dayInTz(o.date, tz);
      const bucket = dayBuckets.get(d);
      if (bucket) bucket.comandas += 1;
    }
    const tendenciaVisitas = dayList.map((date) => {
      const b = dayBuckets.get(date)!;
      return { date, agendamentos: b.agendamentos, comandas: b.comandas };
    });

    // ---- 6. Agendamentos por status (donut) -----------------------------------
    const statusCounts = new Map<string, number>();
    for (const a of appointments) {
      statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
    }
    const agendamentosPorStatus = [...statusCounts.entries()]
      .map(([status, count]) => ({ status, count, pct: this.pct(count, agendamentosCount) }))
      .sort((a, b) => b.count - a.count);

    // ---- 7. Ticket médio ------------------------------------------------------
    const ticketAtual = finishedOrders.length ? vendasTotaisValor / finishedOrders.length : 0;
    const ticketAnterior = prevFinishedOrders.length ? prevVendas / prevFinishedOrders.length : 0;
    const ticketMedio = {
      valor: this.round(ticketAtual),
      deltaPct: this.deltaPct(ticketAtual, ticketAnterior),
    };

    // ---- 9. Atendimentos por profissional (ranking) ---------------------------
    const perProfessional = new Map<string, { name: string; servicos: number; receita: number }>();
    for (const o of finishedOrders) {
      for (const item of o.items) {
        const pid = item.professionalId ?? o.professionalId ?? '__none__';
        const name =
          pid === '__none__' ? 'Sem profissional' : professionalName.get(pid) ?? 'Sem profissional';
        const line = Number(item.grossValue) - Number(item.discount);
        const entry = perProfessional.get(pid) ?? { name, servicos: 0, receita: 0 };
        if (item.kind === 'service') entry.servicos += 1;
        entry.receita += line;
        perProfessional.set(pid, entry);
      }
    }
    const totalReceitaProf = [...perProfessional.values()].reduce((acc, e) => acc + e.receita, 0);
    const atendimentosPorProfissional = [...perProfessional.entries()]
      .map(([pid, e]) => ({
        professionalId: pid === '__none__' ? null : pid,
        name: e.name,
        servicos: e.servicos,
        receita: this.round(e.receita),
        pct: this.pct(e.receita, totalReceitaProf),
      }))
      .sort((a, b) => b.receita - a.receita);

    // ---- 10. Vendas por categoria ---------------------------------------------
    const perCategory = new Map<string, number>();
    for (const o of finishedOrders) {
      for (const item of o.items) {
        const catName =
          (item.kind === 'service'
            ? serviceCategory.get(item.refId)
            : productCategory.get(item.refId)) ?? 'Sem categoria';
        const line = Number(item.grossValue) - Number(item.discount);
        perCategory.set(catName, (perCategory.get(catName) ?? 0) + line);
      }
    }
    const totalCategoria = [...perCategory.values()].reduce((acc, v) => acc + v, 0);
    const vendasPorCategoria = [...perCategory.entries()]
      .map(([categoria, valor]) => ({
        categoria,
        valor: this.round(valor),
        pct: this.pct(valor, totalCategoria),
      }))
      .sort((a, b) => b.valor - a.valor);

    // ---- 11. Funil de conversão -----------------------------------------------
    // "Faturado" = o agendamento virou comanda. Contar `status === finished` no
    // agendamento não funciona: a operação (e o import do Belasis) deixa tudo em
    // "Confirmado", então o funil ficava sempre 0. computeFunnel casa o
    // agendamento com uma comanda FINALIZADA do mesmo cliente no mesmo dia — a
    // regra já existia (com testes) mas nunca tinha sido ligada aqui.
    const funil = computeFunnel(appointments, orders, (d) => this.dayInTz(d, tz));

    // ---- 12. Ocupação da agenda -----------------------------------------------
    // Available minutes per weekday occurrence, summed over the window; busy
    // minutes come from the actual (non-canceled) appointment durations.
    const weekdayOccurrences = this.weekdayOccurrences(dayList, tz);
    const busyMinutes = new Map<string, number>();
    for (const a of appointments) {
      if (!a.professionalId) continue;
      if (!NON_CANCELED_STATUSES.includes(a.status)) continue;
      const min = (a.end.getTime() - a.start.getTime()) / 60000;
      busyMinutes.set(a.professionalId, (busyMinutes.get(a.professionalId) ?? 0) + min);
    }
    const ocupacaoAgenda = professionals
      .map((p) => {
        let availableMin = 0;
        for (const s of p.schedules) {
          const winMin = this.minutesOfWindow(s.startTime, s.endTime);
          availableMin += winMin * (weekdayOccurrences.get(s.weekday) ?? 0);
        }
        const busy = busyMinutes.get(p.id) ?? 0;
        const pct = availableMin > 0 ? this.round(Math.min(100, (busy / availableMin) * 100)) : 0;
        return { professionalId: p.id, name: p.name, pct };
      })
      .sort((a, b) => b.pct - a.pct);

    // ---- 13. Mapa de calor (hora 8..19 x weekday 0..6) ------------------------
    const hours = Array.from({ length: HEAT_HOUR_END - HEAT_HOUR_START + 1 }, (_, i) => HEAT_HOUR_START + i);
    const matrix: number[][] = hours.map(() => new Array<number>(7).fill(0));
    let heatMax = 0;
    for (const a of appointments) {
      const { hour, weekday } = this.hourWeekdayInTz(a.start, tz);
      if (hour < HEAT_HOUR_START || hour > HEAT_HOUR_END) continue;
      const row = hour - HEAT_HOUR_START;
      matrix[row][weekday] += 1;
      if (matrix[row][weekday] > heatMax) heatMax = matrix[row][weekday];
    }

    return {
      period: { from: fromDay, to: toDay, timezone: tz },
      vendasTotais: { valor: this.round(vendasTotaisValor), deltaPct: this.deltaPct(vendasTotaisValor, prevVendas) },
      vendasDia: this.round(vendasDia),
      agendamentosCount: { valor: agendamentosCount, deltaPct: this.deltaPct(agendamentosCount, prevAppointmentsCount) },
      comandasCount: { valor: comandasCount, taxaConversao },
      tendenciaVisitas,
      agendamentosPorStatus,
      ticketMedio,
      comparacaoPeriodos: { anterior: this.round(prevVendas), atual: this.round(vendasTotaisValor) },
      atendimentosPorProfissional,
      vendasPorCategoria,
      funil,
      ocupacaoAgenda,
      mapaCalor: { hours, weekdays: [0, 1, 2, 3, 4, 5, 6], matrix, max: heatMax },
    };
  }

  // ===========================================================================
  // Number / percentage helpers
  // ===========================================================================

  private sumDecimal(values: unknown[]): number {
    return values.reduce<number>((acc, v) => acc + Number(v), 0);
  }

  private round(n: number, digits = 2): number {
    const f = 10 ** digits;
    return Math.round((n + Number.EPSILON) * f) / f;
  }

  private pct(part: number, total: number): number {
    return total > 0 ? this.round((part / total) * 100) : 0;
  }

  private deltaPct(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return this.round(((current - previous) / previous) * 100);
  }

  private minutesOfWindow(startTime: string, endTime: string): number {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const min = eh * 60 + em - (sh * 60 + sm);
    return min > 0 ? min : 0;
  }

  // ===========================================================================
  // Timezone helpers (company-tz wall-clock <-> UTC instants)
  // ===========================================================================

  private async companyTimezone(companyId: string): Promise<string> {
    const company = await this.prisma.client.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    return company?.timezone ?? 'America/Sao_Paulo';
  }

  private parseDay(value?: string): string | null {
    if (!value) return null;
    const day = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  }

  private tzParts(d: Date, tz: string): Record<string, string> {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
    return Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  }

  private dayInTz(d: Date, tz: string): string {
    const p = this.tzParts(d, tz);
    return `${p.year}-${p.month}-${p.day}`;
  }

  private weekdayOfInstant(d: Date, tz: string): number {
    const wd = this.tzParts(d, tz).weekday;
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
  }

  private hourWeekdayInTz(d: Date, tz: string): { hour: number; weekday: number } {
    const p = this.tzParts(d, tz);
    return { hour: Number(p.hour), weekday: this.weekdayOfInstant(d, tz) };
  }

  private weekdayOf(day: string, tz: string): number {
    const noon = this.zonedWallClockToUtc(day, '12:00', tz);
    return this.weekdayOfInstant(noon, tz);
  }

  // Convert a wall-clock (YYYY-MM-DD, HH:mm) in IANA tz to the UTC instant.
  private zonedWallClockToUtc(day: string, hhmm: string, tz: string): Date {
    const [y, mo, d] = day.split('-').map(Number);
    const [h, mi] = hhmm.split(':').map(Number);
    const provisional = Date.UTC(y, mo - 1, d, h, mi, 0);
    const asTz = this.tzParts(new Date(provisional), tz);
    const renderedUtc = Date.UTC(
      Number(asTz.year),
      Number(asTz.month) - 1,
      Number(asTz.day),
      Number(asTz.hour),
      Number(asTz.minute),
      Number(asTz.second),
    );
    const offset = renderedUtc - provisional;
    return new Date(provisional - offset);
  }

  // Add `n` calendar days to a YYYY-MM-DD day (resolved in the company tz).
  private addDays(day: string, n: number, tz: string): string {
    const base = this.zonedWallClockToUtc(day, '12:00', tz);
    return this.dayInTz(new Date(base.getTime() + n * 86400000), tz);
  }

  // Inclusive list of YYYY-MM-DD days between `fromDay` and `toDay`.
  private dayRange(fromDay: string, toDay: string, tz: string): string[] {
    const days: string[] = [];
    let cursor = fromDay;
    // Guard against inverted ranges and runaway loops (cap at ~3 years).
    for (let i = 0; i < 1100 && cursor <= toDay; i += 1) {
      days.push(cursor);
      cursor = this.addDays(cursor, 1, tz);
    }
    return days;
  }

  // Count how many times each weekday (0=Sun..6=Sat) occurs across a day list.
  private weekdayOccurrences(days: string[], tz: string): Map<number, number> {
    const counts = new Map<number, number>();
    for (const day of days) {
      const wd = this.weekdayOf(day, tz);
      counts.set(wd, (counts.get(wd) ?? 0) + 1);
    }
    return counts;
  }
}
