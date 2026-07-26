import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@beautypass/shared';
import { api } from '../api';
import { API_BASE_URL } from '../config';
import { toastSuccess } from '../toast';

/**
 * DELETE com corpo JSON. O `api` compartilhado não envia body em DELETE (só
 * query), mas `DELETE /commission-payments/:id` exige `{ justification }` no
 * corpo. Reproduzimos aqui o mesmo contrato (credentials + ApiClientError) só
 * para esse caso, sem tocar no client compartilhado.
 */
async function deleteWithBody<T>(path: string, body: unknown): Promise<T> {
  const res = await window.fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const errBody = json as { message?: string | string[] } | undefined;
    const message = errBody
      ? Array.isArray(errBody.message)
        ? errBody.message.join(', ')
        : errBody.message ?? res.statusText
      : res.statusText;
    throw new ApiClientError(res.status, message, errBody as never);
  }
  return json as T;
}

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

export type CommissionPayer = 'proportional' | 'company' | 'professional';

export interface CommissionRuleSettings {
  cardFeePaidBy?: CommissionPayer;
  discountPaidBy?: CommissionPayer;
  additionalCostPaidBy?: CommissionPayer;
  basis?: 'competence' | 'availability';
  consider?: 'all' | 'finished';
  consumedProducts?: 'deduct' | 'ignore';
  consumedPriceBy?: 'none' | 'cost' | 'price' | 'professional';
  showGrossValue?: boolean;
  receiptText?: string;
}

export interface CommissionBucket {
  total: number;
  count: number;
}

export interface CommissionOverview {
  emAberto: CommissionBucket;
  aLiberar: CommissionBucket;
  pagas: CommissionBucket;
}

export interface CommissionDetailOrderItem {
  kind: 'service' | 'product';
  name: string;
  quantity: number;
  unitPrice: number;
  grossValue: number;
}

export interface CommissionDetailItem {
  id: string;
  orderId: string | null;
  orderNumber: number | null;
  customerName: string | null;
  date: string;
  baseAmount: number;
  commissionAmount: number;
  bonusAmount: number;
  status: CommissionEntryStatus;
  signed: boolean;
  availableDate: string | null;
  orderItems: CommissionDetailOrderItem[];
}

export interface CommissionDetail {
  professional: { id: string; name: string };
  period: { from: string | null; to: string | null };
  totals: { base: number; comissao: number; bonus: number; total: number; pago: number };
  signed: boolean;
  count: number;
  items: CommissionDetailItem[];
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
  entryIds?: string[];
  advanceIds?: string[];
  closingId?: string;
  note?: string;
}

// ---- Vales (adiantamentos) ----
export type CommissionAdvanceStatus = 'open' | 'deducted';

export interface CommissionAdvance {
  id: string;
  professional: { id: string; name: string };
  amount: number;
  date: string;
  note: string | null;
  status: CommissionAdvanceStatus;
  paymentId: string | null;
}

export interface CreateAdvanceBody {
  professionalId: string;
  amount: number;
  date?: string;
  note?: string;
}

export interface AdvanceFilters {
  professionalId?: string;
  status?: CommissionAdvanceStatus | '';
}

// ---- Pagamento em lote ----
export interface BulkPaymentItem {
  professionalId: string;
  entryIds?: string[];
  advanceIds?: string[];
  note?: string;
}

export interface BulkPaymentBody {
  items: BulkPaymentItem[];
  closingId?: string;
}

export interface CommissionPaymentRecord {
  id: string;
  professionalId: string;
  commissionTotal: string;
  bonusTotal: string;
  advancesTotal: string;
  amount: string;
  entriesCount: number;
}

export interface BulkPaymentResult {
  count: number;
  payments: CommissionPaymentRecord[];
}

// ---- Histórico de pagamentos ----
export interface CommissionPayment {
  id: string;
  paidAt: string;
  professional: { id: string; name: string };
  paidByUser: { id: string; name: string } | null;
  commissionTotal: number;
  bonusTotal: number;
  advancesTotal: number;
  amount: number;
  closingId: string | null;
  note: string | null;
  entriesCount: number;
}

export interface PaymentFilters {
  professionalId?: string;
  from?: string;
  to?: string;
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

export function useCommissionOverview(
  filters: { from?: string; to?: string; professionalId?: string } = {},
) {
  return useQuery({
    queryKey: ['commission-overview', filters],
    queryFn: () =>
      api.get<CommissionOverview>('/commissions/overview', {
        from: filters.from || undefined,
        to: filters.to || undefined,
        professionalId: filters.professionalId || undefined,
      }),
  });
}

export function useCommissionDetail(
  professionalId: string | null,
  filters: { from?: string; to?: string; status?: string } = {},
) {
  return useQuery({
    queryKey: ['commission-detail', professionalId, filters],
    enabled: !!professionalId,
    queryFn: () =>
      api.get<CommissionDetail>('/commissions/detail', {
        professionalId: professionalId as string,
        from: filters.from || undefined,
        to: filters.to || undefined,
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
      qc.invalidateQueries({ queryKey: ['commission-overview'] });
      qc.invalidateQueries({ queryKey: ['commission-advances'] });
      qc.invalidateQueries({ queryKey: ['commission-payments'] });
      toastSuccess('Pagamento de comissão registrado');
    },
  });
}

// =====================================================================
// Vales (adiantamentos)
// =====================================================================

export function useCommissionAdvances(filters: AdvanceFilters = {}) {
  return useQuery({
    queryKey: ['commission-advances', filters],
    queryFn: () =>
      api.get<CommissionAdvance[]>('/commission-advances', {
        professionalId: filters.professionalId || undefined,
        status: filters.status || undefined,
      }),
  });
}

export function useCreateAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAdvanceBody) =>
      api.post<CommissionAdvance>('/commission-advances', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-advances'] });
      toastSuccess('Vale registrado');
    },
  });
}

export function useDeleteAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/commission-advances/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-advances'] });
      toastSuccess('Vale excluído');
    },
  });
}

// =====================================================================
// Pagamento em lote (fórmula Belasis: Comissões − Vales + Bônus)
// =====================================================================

export function usePayCommissionsBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkPaymentBody) =>
      api.post<BulkPaymentResult>('/commission-payments/bulk', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-entries'] });
      qc.invalidateQueries({ queryKey: ['commission-summary'] });
      qc.invalidateQueries({ queryKey: ['commission-overview'] });
      qc.invalidateQueries({ queryKey: ['commission-advances'] });
      qc.invalidateQueries({ queryKey: ['commission-payments'] });
      qc.invalidateQueries({ queryKey: ['commission-detail'] });
    },
  });
}

// =====================================================================
// Histórico de pagamentos
// =====================================================================

export function useCommissionPayments(filters: PaymentFilters = {}) {
  return useQuery({
    queryKey: ['commission-payments', filters],
    queryFn: () =>
      api.get<CommissionPayment[]>('/commission-payments', {
        professionalId: filters.professionalId || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      }),
  });
}

export function useDeleteCommissionPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, justification }: { id: string; justification: string }) =>
      deleteWithBody<{ id: string; deleted: boolean }>(
        `/commission-payments/${id}`,
        { justification },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-entries'] });
      qc.invalidateQueries({ queryKey: ['commission-summary'] });
      qc.invalidateQueries({ queryKey: ['commission-overview'] });
      qc.invalidateQueries({ queryKey: ['commission-advances'] });
      qc.invalidateQueries({ queryKey: ['commission-payments'] });
      qc.invalidateQueries({ queryKey: ['commission-detail'] });
      toastSuccess('Pagamento estornado');
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-rules'] });
      toastSuccess('Regra de comissão criada');
    },
  });
}

export function useUpdateCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCommissionRuleBody }) =>
      api.patch<CommissionRule>(`/commission-rules/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-rules'] });
      toastSuccess('Regra de comissão salva');
    },
  });
}

export function useDeleteCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/commission-rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-rules'] });
      toastSuccess('Regra de comissão excluída');
    },
  });
}
