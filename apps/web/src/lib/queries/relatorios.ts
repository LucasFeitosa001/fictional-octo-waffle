import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export interface RankItem {
  id: string;
  name: string;
  count: number;
  total: number;
}

export interface ProfessionalRankItem {
  id: string;
  name: string;
  total: number;
}

export interface SalesByDayItem {
  date: string;
  total: number;
}

export interface PaymentByMethodItem {
  paymentMethodId: string | null;
  name: string;
  total: number;
}

export interface NewCustomerItem {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  createdAt: string;
}

export interface BirthdayItem {
  id: string;
  name: string;
  phone?: string | null;
  day: number | null;
}

export interface ReportsOverview {
  period: { from: string | null; to: string | null };
  salesTotal: number;
  ordersCount: number;
  salesByDay: SalesByDayItem[];
  topServices: RankItem[];
  topProducts: RankItem[];
  topProfessionals: ProfessionalRankItem[];
  paymentsByMethod: PaymentByMethodItem[];
  occupancy: { total: number; done: number; canceled: number; rate: number };
  newCustomers: NewCustomerItem[];
  newCustomersCount: number;
  birthdaysMonth: number;
  birthdays: BirthdayItem[];
}

export function useReportsOverview(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-overview', from, to],
    queryFn: () =>
      api.get<ReportsOverview>('/reports/overview', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* ---------------------------------------------------------------- DRE ---- */

export interface DreLinha {
  categoria: string;
  tipo: 'receita' | 'despesa';
  valor: number;
}

export interface ReportsDre {
  period: { from: string | null; to: string | null };
  linhas: DreLinha[];
  receitas: { linhas: DreLinha[]; total: number };
  despesas: { linhas: DreLinha[]; total: number };
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
  comandas: {
    ordersCount: number;
    receitaComandas: number;
    receitaServicos: number;
    receitaProdutos: number;
  };
}

export function useReportsDre(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-dre', from, to],
    queryFn: () =>
      api.get<ReportsDre>('/reports/dre', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* -------------------------------------------------- inventory (estoque) -- */

export interface InventorySuggestionItem {
  productId: string;
  name: string;
  stock: number;
  minStock: number;
  deficit: number;
}

export interface ReportsInventorySuggestion {
  count: number;
  items: InventorySuggestionItem[];
}

export function useReportsInventorySuggestion() {
  return useQuery({
    queryKey: ['reports-inventory-suggestion'],
    queryFn: () =>
      api.get<ReportsInventorySuggestion>('/reports/inventory-suggestion'),
  });
}

/* --------------------------------------------------------- mensagens ----- */

export interface MessageChannelItem {
  channel: string;
  label: string;
  count: number;
}

export interface MessageTypeItem {
  type: string;
  label: string;
  count: number;
}

export interface ReportsMessages {
  period: { from: string | null; to: string | null };
  totalSent: number;
  byChannel: MessageChannelItem[];
  byType: MessageTypeItem[];
  sources: {
    whatsappOutbox: number;
    campaignMessages: number;
    appointmentNotifications: number;
    notifications: number;
  };
}

export function useReportsMessages(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-messages', from, to],
    queryFn: () =>
      api.get<ReportsMessages>('/reports/messages', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* ------------------------------- mensagens: linhas por mensagem ---------- */

export interface MessageRowItem {
  id: string;
  /** ISO — quando a mensagem foi enviada (ou criada, se ainda pendente). */
  at: string;
  toPhone: string;
  customerName: string | null;
  kind: string | null;
  status: string;
  textPreview: string;
}

export interface ReportsMessagesRows {
  period: { from: string | null; to: string | null };
  rows: MessageRowItem[];
  limit: number;
  offset: number;
  totals: { count: number };
}

export interface ReportsMessagesRowsFilters {
  from?: string;
  to?: string;
  status?: string;
  kind?: string;
  limit?: number;
  offset?: number;
}

export function useReportsMessagesRows(filters: ReportsMessagesRowsFilters) {
  const { from, to, status, kind, limit, offset } = filters;
  return useQuery({
    queryKey: [
      'reports-messages-rows',
      from ?? null,
      to ?? null,
      status ?? null,
      kind ?? null,
      limit ?? null,
      offset ?? null,
    ],
    queryFn: () =>
      api.get<ReportsMessagesRows>('/reports/messages/rows', {
        from: from || undefined,
        to: to || undefined,
        status: status || undefined,
        kind: kind || undefined,
        limit: limit ?? undefined,
        offset: offset ?? undefined,
      }),
  });
}

/* ----------------------------------------------------- aniversariantes --- */

export interface ReportsBirthdays {
  month: number;
  count: number;
  customers: BirthdayItem[];
}

export function useReportsBirthdays(month: number) {
  return useQuery({
    queryKey: ['reports-birthdays', month],
    queryFn: () =>
      api.get<ReportsBirthdays>('/reports/birthdays', {
        month: String(month),
      }),
  });
}

/* -------------------------------------------------------------- vendas --- */

export interface SalesByProfessionalItem {
  id: string;
  name: string;
  total: number;
}

export interface SalesByCategoryItem {
  category: string;
  total: number;
}

export interface ReportsSales {
  period: { from: string | null; to: string | null };
  salesTotal: number;
  ordersCount: number;
  byDay: SalesByDayItem[];
  byProfessional: SalesByProfessionalItem[];
  byCategory: SalesByCategoryItem[];
}

export function useReportsSales(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-sales', from, to],
    queryFn: () =>
      api.get<ReportsSales>('/reports/sales', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* ---------------------------------------- resultado líquido de serviços -- */

export interface ServiceRevenueItem {
  id: string;
  name: string;
  count: number;
  revenue: number;
  cost: number;
  commission: number;
  net: number;
}

export interface ReportsServiceRevenue {
  period: { from: string | null; to: string | null };
  totalRevenue: number;
  totalCost: number;
  totalCommission: number;
  totalNet: number;
  items: ServiceRevenueItem[];
}

export function useReportsServiceRevenue(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-service-revenue', from, to],
    queryFn: () =>
      api.get<ReportsServiceRevenue>('/reports/service-revenue', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* ---------------------------------------- resultado líquido de produtos -- */

export interface ProductRevenueItem {
  id: string;
  name: string;
  count: number;
  revenue: number;
  cost: number;
  net: number;
}

export interface ReportsProductRevenue {
  period: { from: string | null; to: string | null };
  totalRevenue: number;
  totalCost: number;
  totalNet: number;
  items: ProductRevenueItem[];
}

export function useReportsProductRevenue(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-product-revenue', from, to],
    queryFn: () =>
      api.get<ReportsProductRevenue>('/reports/product-revenue', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* ------------------------------------------- projeção de faturamento ----- */

export interface BillingProjectionPoint {
  month: string; // "YYYY-MM"
  actual: number | null; // realizado (histórico)
  projected: number | null; // projetado
}

export interface ReportsBillingProjection {
  period: { from: string | null; to: string | null };
  historyAverage: number;
  projectedTotal: number;
  points: BillingProjectionPoint[];
}

export function useReportsBillingProjection(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-billing-projection', from, to],
    queryFn: () =>
      api.get<ReportsBillingProjection>('/reports/billing-projection', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* ----------------------------------------- aging (recebimentos/despesas) - */

export interface AgingBucket {
  bucket: string;
  label: string;
  count: number;
  total: number;
}

export interface BillItem {
  id: string;
  description: string;
  party: string; // cliente (recebimentos) ou fornecedor (despesas)
  dueDate: string;
  amount: number;
  status: string; // 'open' | 'overdue' | 'paid' | 'received'
  daysOverdue: number;
}

export interface ReportsBillAging {
  period: { from: string | null; to: string | null };
  totalOpen: number;
  totalOverdue: number;
  totalSettled: number; // recebido (recs) / pago (pays)
  buckets: AgingBucket[];
  items: BillItem[];
}

export function useReportsBillRecs(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-bill-recs', from, to],
    queryFn: () =>
      api.get<ReportsBillAging>('/reports/bill-recs', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

export function useReportsBillPays(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-bill-pays', from, to],
    queryFn: () =>
      api.get<ReportsBillAging>('/reports/bill-pays', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* ------------------------------------- agenda: agendamentos excluídos ---- */

export interface DeletedAppointmentItem {
  id: string;
  customerName: string | null;
  professionalName: string | null;
  serviceName: string | null;
  /** ISO — quando o agendamento estava marcado. */
  start: string;
  /** ISO — quando o agendamento foi excluído/cancelado. */
  deletedAt: string | null;
  /** Nome do usuário que excluiu (quando registrado). */
  deletedBy: string | null;
  reason: string | null;
}

export interface DeletedByDayItem {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface ReportsCalendarDeleted {
  period: { from: string | null; to: string | null };
  totalDeleted: number;
  byDay: DeletedByDayItem[];
  items: DeletedAppointmentItem[];
}

export function useReportsAgendamentosExcluidos(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-calendar-deleted', from, to],
    queryFn: () =>
      api.get<ReportsCalendarDeleted>('/reports/calendars/deleted', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* ---------------------------------------- agenda: origem dos agendamentos - */

export interface AppointmentOriginItem {
  source: string; // 'admin' | 'online' | ...
  label: string; // 'Balcão' | 'Online' | ...
  count: number;
}

export interface ReportsCalendarOrigin {
  period: { from: string | null; to: string | null };
  total: number;
  byOrigin: AppointmentOriginItem[];
}

export function useReportsOrigemAgendamentos(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-calendar-origin', from, to],
    queryFn: () =>
      api.get<ReportsCalendarOrigin>('/reports/calendars/origin', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* ------------------------------------- agenda: criação de agendamento ----- */

export interface AppointmentCreationByDayItem {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface AppointmentCreationByAuthorItem {
  userId: string | null;
  name: string;
  count: number;
}

export interface ReportsCalendarCreation {
  period: { from: string | null; to: string | null };
  total: number;
  byDay: AppointmentCreationByDayItem[];
  byAuthor: AppointmentCreationByAuthorItem[];
}

export function useReportsCriacaoAgendamento(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-calendar-creation', from, to],
    queryFn: () =>
      api.get<ReportsCalendarCreation>('/reports/calendars/creation', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* ------------------------------------------ agenda: cuidados para hoje ---- */

export interface CareMessageItem {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  serviceName: string | null;
  /** ISO — quando o atendimento aconteceu. */
  appointmentAt: string;
  /** Mensagem de cuidados sugerida a enviar ao cliente. */
  message: string;
  sent: boolean;
}

export interface ReportsCareMessagesToday {
  date: string; // YYYY-MM-DD (hoje por padrão)
  total: number;
  pending: number;
  sent: number;
  items: CareMessageItem[];
}

export function useReportsCuidadosHoje(date: string) {
  return useQuery({
    queryKey: ['reports-care-today', date],
    queryFn: () =>
      api.get<ReportsCareMessagesToday>('/reports/calendars/care-messages-today', {
        date: date || undefined,
      }),
  });
}

/* ------------------------------- estoque: movimentação de estoque -------- */

export type InventoryMovementType = 'entrada' | 'saida' | 'ajuste';

export interface InventoryMovementItem {
  id: string;
  /** ISO — quando a movimentação ocorreu. */
  date: string;
  productId: string;
  productName: string;
  type: InventoryMovementType;
  /** Rótulo legível ("Entrada" | "Saída" | "Ajuste"). */
  label: string;
  /** Quantidade movimentada (magnitude, sempre positiva). */
  quantity: number;
  /** Motivo/origem (compra, venda, ajuste manual, consumo…). */
  reason: string | null;
  /** Estoque resultante após a movimentação. */
  balanceAfter: number | null;
}

export interface InventoryMovementByType {
  type: InventoryMovementType;
  label: string;
  count: number;
  quantity: number;
}

export interface ReportsInventoryMovements {
  period: { from: string | null; to: string | null };
  /** Total de unidades que entraram no estoque. */
  totalIn: number;
  /** Total de unidades que saíram do estoque. */
  totalOut: number;
  /** Saldo do período (entradas − saídas). */
  balance: number;
  movementsCount: number;
  byType: InventoryMovementByType[];
  items: InventoryMovementItem[];
}

export function useReportsInventoryMovements(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-inventory-movements', from, to],
    queryFn: () =>
      api.get<ReportsInventoryMovements>('/reports/inventory/movements', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* ------------------------------------------------- estoque: compras ------ */

export interface PurchaseItem {
  id: string;
  /** ISO — data da compra. */
  date: string;
  supplierId: string | null;
  supplierName: string;
  productName: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface PurchaseBySupplierItem {
  supplierId: string | null;
  name: string;
  count: number;
  total: number;
}

export interface ReportsInventoryPurchases {
  period: { from: string | null; to: string | null };
  /** Valor total comprado no período. */
  totalValue: number;
  /** Número de compras (documentos/entradas). */
  purchasesCount: number;
  /** Número de itens de produto comprados. */
  itemsCount: number;
  bySupplier: PurchaseBySupplierItem[];
  items: PurchaseItem[];
}

export function useReportsInventoryPurchases(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-inventory-purchases', from, to],
    queryFn: () =>
      api.get<ReportsInventoryPurchases>('/reports/inventory/purchases', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

/* --------------------------------------- estoque: produtos consumidos ---- */

export interface ConsumedProductItem {
  id: string;
  name: string;
  /** Quantidade consumida internamente no período. */
  quantity: number;
  /** Custo total do consumo (custo unitário × quantidade). */
  cost: number;
}

export interface ReportsInventoryConsumed {
  period: { from: string | null; to: string | null };
  totalQuantity: number;
  totalCost: number;
  items: ConsumedProductItem[];
}

export function useReportsInventoryConsumed(from: string, to: string) {
  return useQuery({
    queryKey: ['reports-inventory-consumed', from, to],
    queryFn: () =>
      api.get<ReportsInventoryConsumed>('/reports/inventory/consumed', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}
