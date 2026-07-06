import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// =====================================================================
// Types — COMISSÕES. Money/decimal fields are Decimal strings from the API,
// but the summary endpoint returns computed numbers.
// =====================================================================

export type CommissionScopeType = 'service' | 'product' | 'category' | 'all';
export type AmountType = 'percent' | 'fixed';
export type CommissionEntryStatus = 'open' | 'paid' | 'reversed';

export interface CommissionSummaryRow {
  professionalId: string;
  professionalName: string;
  valorVendido: number;
  comissao: number;
  bonus: number;
  total: number;
  entryCount: number;
  openCount: number;
  paidCount: number;
  signedCount: number;
  status: 'paid' | 'open';
  signed: boolean;
}

export interface CommissionSummary {
  data: CommissionSummaryRow[];
  totals: { valorVendido: number; comissao: number; bonus: number; total: number };
}

export interface CommissionEntry {
  id: string;
  companyId: string;
  professionalId: string;
  orderId?: string | null;
  baseAmount: string;
  commissionAmount: string;
  bonusAmount: string;
  status: CommissionEntryStatus;
  competenceDate?: string | null;
  availableDate?: string | null;
  signed: boolean;
  createdAt: string;
  updatedAt: string;
  professional?: { id: string; name: string };
}

export interface CommissionRuleSettings {
  cardFeePaidBy?: 'company' | 'professional';
  discountPaidBy?: 'company' | 'professional';
  additionalCostPaidBy?: 'company' | 'professional';
  basis?: 'competence' | 'availability';
  consider?: 'all' | 'finished';
}

export interface CommissionRule {
  id: string;
  companyId: string;
  scopeType: CommissionScopeType;
  scopeId?: string | null;
  type: AmountType;
  value: string;
  settingsJson?: CommissionRuleSettings | null;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryFilters {
  from?: string;
  to?: string;
  professionalId?: string;
  status?: string;
}

export interface CreateCommissionRuleBody {
  scopeType: CommissionScopeType;
  scopeId?: string;
  type: AmountType;
  value: number;
  settingsJson?: CommissionRuleSettings;
}

export type UpdateCommissionRuleBody = Partial<CreateCommissionRuleBody>;

export interface CommissionPaymentBody {
  professionalId: string;
  amount: number;
  entryIds?: string[];
  closingId?: string;
}

// =====================================================================
// Hooks
// =====================================================================

export function useCommissionSummary(filters: SummaryFilters = {}) {
  return useQuery({
    queryKey: ['commission-summary', filters],
    queryFn: () =>
      api.get<CommissionSummary>('/commissions/summary', {
        from: filters.from || undefined,
        to: filters.to || undefined,
        professionalId: filters.professionalId || undefined,
        status: filters.status || undefined,
      }),
  });
}

export function useCommissionEntries(filters: { status?: string; professionalId?: string } = {}) {
  return useQuery({
    queryKey: ['commission-entries', filters],
    queryFn: () =>
      api.get<CommissionEntry[]>('/commissions', {
        status: filters.status || undefined,
        professionalId: filters.professionalId || undefined,
      }),
  });
}

export function useUpdateCommissionEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { status?: CommissionEntryStatus; signed?: boolean };
    }) => api.patch<CommissionEntry>(`/commissions/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-entries'] });
      qc.invalidateQueries({ queryKey: ['commission-summary'] });
    },
  });
}

export function useCreateCommissionPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CommissionPaymentBody) =>
      api.post<{ id: string }>('/commission-payments', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-entries'] });
      qc.invalidateQueries({ queryKey: ['commission-summary'] });
    },
  });
}

export function useCommissionRules() {
  return useQuery({
    queryKey: ['commission-rules'],
    queryFn: () => api.get<CommissionRule[]>('/commission-rules'),
  });
}

export function useCreateCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCommissionRuleBody) =>
      api.post<CommissionRule>('/commission-rules', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-rules'] }),
  });
}

export function useUpdateCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCommissionRuleBody }) =>
      api.patch<CommissionRule>(`/commission-rules/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-rules'] }),
  });
}

export function useDeleteCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/commission-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-rules'] }),
  });
}
