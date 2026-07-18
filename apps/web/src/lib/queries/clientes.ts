import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type {
  CustomerCreditsResponse,
  CustomerDebt,
  CustomerFull,
  CustomerPanel,
} from '../types';

export interface CustomerDependentInput {
  name: string;
  relationship?: string;
}

export interface CustomerSocialProfileInput {
  platform: string;
  url: string;
}

export interface CustomerBody {
  name: string;
  nickname?: string;
  phone?: string;
  secondaryPhone?: string;
  email?: string;
  birthday?: string;
  cpf?: string;
  cnpj?: string;
  active?: boolean;
  // Cliente — profundidade (P0)
  rg?: string;
  avatarUrl?: string;
  referredById?: string;
  defaultDiscountPercent?: number;
  notificationsEnabled?: boolean;
  whatsappOptIn?: boolean;
  smsOptIn?: boolean;
  onlineAccessBlocked?: boolean;
  tags?: string[];
  dependents?: CustomerDependentInput[];
  socialProfiles?: CustomerSocialProfileInput[];
}

export interface CreateDebtBody {
  amount: number;
  origin?: string;
  dueDate?: string;
}

export interface PayDebtBody {
  amount: number;
  method?: string;
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CustomerBody) => api.post<CustomerFull>('/customers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CustomerBody> }) =>
      api.patch<CustomerFull>(`/customers/${id}`, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer-panel', id] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<CustomerFull>(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

/** GET /customers/:id/panel — real metrics for the customer profile Painel tab. */
export function useCustomerPanel(id: string | null | undefined) {
  return useQuery({
    queryKey: ['customer-panel', id],
    queryFn: () => api.get<CustomerPanel>(`/customers/${id}/panel`),
    enabled: Boolean(id),
  });
}

/** GET /customers/:id/debts — customer debts with payments. */
export function useCustomerDebts(id: string | null | undefined) {
  return useQuery({
    queryKey: ['customer-debts', id],
    queryFn: () => api.get<CustomerDebt[]>(`/customers/${id}/debts`),
    enabled: Boolean(id),
  });
}

/** POST /customers/:id/debts — create a new debt. */
export function useCreateDebt(id: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDebtBody) =>
      api.post<CustomerDebt>(`/customers/${id}/debts`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-debts', id] });
      qc.invalidateQueries({ queryKey: ['customer-panel', id] });
    },
  });
}

/** POST /customers/:id/debts/:debtId/payments — register a debt payment. */
export function usePayDebt(id: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ debtId, body }: { debtId: string; body: PayDebtBody }) =>
      api.post<CustomerDebt>(`/customers/${id}/debts/${debtId}/payments`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-debts', id] });
      qc.invalidateQueries({ queryKey: ['customer-panel', id] });
    },
  });
}

/** GET /customers/:id/credits — credit + cashback ledger and balances. */
export function useCustomerCredits(id: string | null | undefined) {
  return useQuery({
    queryKey: ['customer-credits', id],
    queryFn: () => api.get<CustomerCreditsResponse>(`/customers/${id}/credits`),
    enabled: Boolean(id),
  });
}
