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
