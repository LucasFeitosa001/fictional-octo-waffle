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
  avatarUrl?: string | null;
  referredById?: string;
  defaultDiscountPercent?: number;
  notificationsEnabled?: boolean;
  whatsappOptIn?: boolean;
  smsOptIn?: boolean;
  onlineAccessBlocked?: boolean;
  tags?: string[];
  dependents?: CustomerDependentInput[];
  socialProfiles?: CustomerSocialProfileInput[];
  // Endereço embutido + observações livres (Wave 2/3)
  cep?: string;
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  complement?: string;
  observations?: string;
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

// ---------------------------------------------------------------------------
// Views de dados relacionados do cliente (abas do perfil)
// ---------------------------------------------------------------------------

export interface CustomerAppointmentView {
  id: string;
  status: string;
  start: string;
  end: string;
  notes: string | null;
  professional: { id: string; name: string } | null;
  items: Array<{
    id: string;
    price: string;
    durationMin: number;
    service: { id: string; name: string } | null;
  }>;
}

export interface CustomerOrderView {
  id: string;
  number: number;
  status: string;
  date: string;
  grossTotal: string;
  discountTotal: string;
  netTotal: string;
  professional: { id: string; name: string } | null;
  items: Array<{
    id: string;
    kind: string;
    quantity: string;
    unitPrice: string;
    grossValue: string;
    discount: string;
  }>;
}

export interface CustomerPackageView {
  id: string;
  number: number;
  status: string;
  price: string;
  expiresAt: string | null;
  createdAt: string;
  template: { id: string; name: string } | null;
  items: Array<{
    id: string;
    sessionsTotal: number;
    sessionsUsed: number;
    service: { id: string; name: string } | null;
  }>;
}

export interface CustomerNoteView {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; name: string } | null;
}

export interface CustomerCashbackEntry {
  id: string;
  amount: string;
  sourceType: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CustomerCashbackResponse {
  cashback: CustomerCashbackEntry[];
  saldo: number;
}

export interface CustomerAnamnesisView {
  id: string;
  templateId: string | null;
  answersJson: Record<string, unknown> | null;
  signedAt: string | null;
  createdAt: string;
}

export interface CustomerFileView {
  id: string;
  url: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
}

export interface CreateFileBody {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export interface CreateNoteBody {
  text: string;
}

export interface CreateAnamnesisBody {
  templateId?: string;
  answersJson?: Record<string, unknown>;
  signedAt?: string;
}

export interface UpdateAnamnesisBody {
  answersJson?: Record<string, unknown>;
  // string ISO assina; null "des-assina"; undefined mantém.
  signedAt?: string | null;
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

/** GET /customers/:id/cashback — cashback ledger + balance. */
export function useCustomerCashback(id: string | null | undefined) {
  return useQuery({
    queryKey: ['customer-cashback', id],
    queryFn: () => api.get<CustomerCashbackResponse>(`/customers/${id}/cashback`),
    enabled: Boolean(id),
  });
}

export interface RedeemCashbackBody {
  amount: number;
  note?: string;
}

export interface AdjustCashbackBody {
  amount: number;
  note?: string;
  expiresAt?: string;
}

export interface CashbackMutationResponse {
  entry: CustomerCashbackEntry;
  saldo: number;
}

/** POST /customers/:id/cashback/redeem — resgata cashback (linha negativa). */
export function useRedeemCashback(id: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RedeemCashbackBody) =>
      api.post<CashbackMutationResponse>(`/customers/${id}/cashback/redeem`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-cashback', id] });
      qc.invalidateQueries({ queryKey: ['customer-credits', id] });
      qc.invalidateQueries({ queryKey: ['customer-panel', id] });
    },
  });
}

/** POST /customers/:id/cashback/adjust — ajuste manual (crédito/débito). */
export function useAdjustCashback(id: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdjustCashbackBody) =>
      api.post<CashbackMutationResponse>(`/customers/${id}/cashback/adjust`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-cashback', id] });
      qc.invalidateQueries({ queryKey: ['customer-credits', id] });
      qc.invalidateQueries({ queryKey: ['customer-panel', id] });
    },
  });
}

/** GET /customers/:id/appointments — appointment history for the customer. */
export function useCustomerAppointments(id: string | null | undefined) {
  return useQuery({
    queryKey: ['customer-appointments', id],
    queryFn: () => api.get<CustomerAppointmentView[]>(`/customers/${id}/appointments`),
    enabled: Boolean(id),
  });
}

/** GET /customers/:id/orders — orders (comandas) of the customer. */
export function useCustomerOrders(id: string | null | undefined) {
  return useQuery({
    queryKey: ['customer-orders', id],
    queryFn: () => api.get<CustomerOrderView[]>(`/customers/${id}/orders`),
    enabled: Boolean(id),
  });
}

/** GET /customers/:id/packages — packages purchased by the customer. */
export function useCustomerPackages(id: string | null | undefined) {
  return useQuery({
    queryKey: ['customer-packages', id],
    queryFn: () => api.get<CustomerPackageView[]>(`/customers/${id}/packages`),
    enabled: Boolean(id),
  });
}

/** GET /customers/:id/notes — free-form notes about the customer. */
export function useCustomerNotes(id: string | null | undefined) {
  return useQuery({
    queryKey: ['customer-notes', id],
    queryFn: () => api.get<CustomerNoteView[]>(`/customers/${id}/notes`),
    enabled: Boolean(id),
  });
}

/** POST /customers/:id/notes — add a note. */
export function useCreateNote(id: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateNoteBody) =>
      api.post<CustomerNoteView>(`/customers/${id}/notes`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-notes', id] }),
  });
}

/** GET /customers/:id/files — imagens e arquivos anexados ao cliente. */
export function useCustomerFiles(id: string | null | undefined) {
  return useQuery({
    queryKey: ['customer-files', id],
    queryFn: () => api.get<CustomerFileView[]>(`/customers/${id}/files`),
    enabled: Boolean(id),
  });
}

/** POST /customers/:id/files — registra um arquivo já enviado ao storage. */
export function useCreateCustomerFile(id: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFileBody) =>
      api.post<CustomerFileView>(`/customers/${id}/files`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-files', id] }),
  });
}

/** DELETE /customers/:id/files/:fileId — remove um arquivo da galeria. */
export function useDeleteCustomerFile(id: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/customers/${id}/files/${fileId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-files', id] }),
  });
}

/** GET /customers/:id/anamneses — anamnesis records of the customer. */
export function useCustomerAnamneses(id: string | null | undefined) {
  return useQuery({
    queryKey: ['customer-anamneses', id],
    queryFn: () => api.get<CustomerAnamnesisView[]>(`/customers/${id}/anamneses`),
    enabled: Boolean(id),
  });
}

/** POST /customers/:id/anamneses — create an anamnesis record. */
export function useCreateAnamnesis(id: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAnamnesisBody) =>
      api.post<CustomerAnamnesisView>(`/customers/${id}/anamneses`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-anamneses', id] }),
  });
}

/** PATCH /customers/:id/anamneses/:anamId — grava respostas e/ou assinatura. */
export function useUpdateAnamnesis(id: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ anamId, body }: { anamId: string; body: UpdateAnamnesisBody }) =>
      api.patch<CustomerAnamnesisView>(`/customers/${id}/anamneses/${anamId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-anamneses', id] }),
  });
}

/** DELETE /customers/:id/anamneses/:anamId — remove uma ficha. */
export function useDeleteAnamnesis(id: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (anamId: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/customers/${id}/anamneses/${anamId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-anamneses', id] }),
  });
}
