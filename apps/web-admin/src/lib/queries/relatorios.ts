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
