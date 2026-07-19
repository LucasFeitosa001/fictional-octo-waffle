import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ===================== Types =====================
export type TransactionKind = 'income' | 'expense';
export type PaymentStatus = 'pending' | 'paid' | 'reversed';
export type FinancialAccountType = 'cash' | 'bank';
export type FinancialCategoryKind = 'debit' | 'credit';
export type PartyType = 'customer' | 'professional' | 'supplier';

export interface FinancialSummary {
  period: { from: string | null; to: string | null };
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byPaymentMethod: {
    paymentMethodId: string | null;
    paymentMethodName: string;
    total: number;
  }[];
  receivableToday: number;
  payableToday: number;
  totals: {
    received: number;
    toReceive: number;
    paid: number;
    toPay: number;
  };
  accounts: {
    id: string;
    name: string;
    type: FinancialAccountType;
    active: boolean;
    initialBalance: number;
    currentBalance: number;
  }[];
  cashFlow: {
    date: string;
    inflow: number;
    outflow: number;
    balance: number;
  }[];
  salesByDay: {
    date: string;
    total: number;
    count: number;
  }[];
}

export interface TransactionRow {
  id: string;
  companyId: string;
  kind: TransactionKind;
  accountId?: string | null;
  categoryId?: string | null;
  paymentMethodId?: string | null;
  partyType?: PartyType | null;
  partyId?: string | null;
  description?: string | null;
  grossAmount: string;
  dueDate?: string | null;
  paidAt?: string | null;
  status: PaymentStatus;
  createdAt: string;
  account?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  paymentMethod?: { id: string; name: string } | null;
  order?: {
    id: string;
    number: number;
    customer?: { id: string; name: string } | null;
  } | null;
}

export interface FinancialAccount {
  id: string;
  companyId: string;
  name: string;
  type: FinancialAccountType;
  initialBalance: string;
  active: boolean;
}

export interface PaymentMethod {
  id: string;
  companyId: string;
  name: string;
  feePercent: string;
  settlementDays: number;
  defaultAccountId?: string | null;
  goesToCash: boolean;
}

export interface FinancialCategory {
  id: string;
  companyId: string;
  name: string;
  kind: FinancialCategoryKind;
  countsAsCommission: boolean;
  isExpense: boolean;
  active: boolean;
}

export interface TransactionFilters {
  type?: TransactionKind;
  status?: PaymentStatus;
  paymentMethodId?: string;
  accountId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  includeReversed?: boolean;
}

export interface TransactionsPage extends Paginated<TransactionRow> {
  totals: { income: number; expense: number; balance: number };
}

export interface CreateTransactionBody {
  kind: TransactionKind;
  grossAmount: number;
  accountId?: string;
  categoryId?: string;
  paymentMethodId?: string;
  partyType?: PartyType;
  partyId?: string;
  description?: string;
  dueDate?: string;
  paidAt?: string;
  status?: PaymentStatus;
}

export interface CreateTransferBody {
  amount: number;
  fromAccountId: string;
  toAccountId: string;
  categoryId?: string;
  description?: string;
  date?: string;
}

export interface CreateFinancialAccountBody {
  name: string;
  type?: FinancialAccountType;
  initialBalance?: number;
}

export interface CreatePaymentMethodBody {
  name: string;
  feePercent?: number;
  settlementDays?: number;
  defaultAccountId?: string;
  goesToCash?: boolean;
}

export interface CreateFinancialCategoryBody {
  name: string;
  kind: FinancialCategoryKind;
  countsAsCommission?: boolean;
  isExpense?: boolean;
}

export type UpdateTransactionBody = Partial<CreateTransactionBody>;
export type UpdateFinancialAccountBody = Partial<CreateFinancialAccountBody> & {
  active?: boolean;
};
export type UpdatePaymentMethodBody = Partial<CreatePaymentMethodBody>;
export type UpdateFinancialCategoryBody = Partial<CreateFinancialCategoryBody> & {
  active?: boolean;
};

type Deleted = { id: string; deleted: boolean };

interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

// ===================== Summary =====================
export function useFinancialSummary(from?: string, to?: string) {
  return useQuery({
    queryKey: ['financial-summary', from ?? null, to ?? null],
    queryFn: () =>
      api.get<FinancialSummary>('/financial/summary', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

// ===================== Transactions =====================
export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () =>
      api.get<TransactionsPage>('/transactions', {
        type: filters.type,
        status: filters.status,
        paymentMethodId: filters.paymentMethodId,
        accountId: filters.accountId,
        categoryId: filters.categoryId,
        from: filters.from,
        to: filters.to,
        page: filters.page,
        pageSize: filters.pageSize,
        includeReversed: filters.includeReversed ? 'true' : undefined,
      }),
  });
}

/**
 * Busca TODAS as transações do filtro atual (sem paginação) — usado para o
 * "Exportar CSV", que deve conter o conjunto inteiro e não só a página visível.
 */
export async function fetchAllTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionRow[]> {
  const res = await api.get<TransactionsPage>('/transactions', {
    type: filters.type,
    status: filters.status,
    paymentMethodId: filters.paymentMethodId,
    accountId: filters.accountId,
    categoryId: filters.categoryId,
    from: filters.from,
    to: filters.to,
    includeReversed: filters.includeReversed ? 'true' : undefined,
    pageSize: 100000,
  });
  return res.data;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTransactionBody) =>
      api.post<TransactionRow>('/transactions', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTransactionBody }) =>
      api.patch<TransactionRow>(`/transactions/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<TransactionRow>(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
    },
  });
}

/** Estorno: preserva a original (marca `reversed`) e cria a contrapartida. */
export function useReverseTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ reversed: TransactionRow; counter: TransactionRow }>(
        `/transactions/${id}/reverse`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
    },
  });
}

/** Transferência entre contas (par de lançamentos). */
export function useCreateTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTransferBody) =>
      api.post<{ out: TransactionRow; income: TransactionRow }>(
        '/transactions/transfer',
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
    },
  });
}

// ===================== Financial accounts =====================
export function useFinancialAccounts() {
  return useQuery({
    queryKey: ['financial-accounts'],
    queryFn: () => api.get<FinancialAccount[]>('/financial-accounts'),
  });
}

export function useCreateFinancialAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFinancialAccountBody) =>
      api.post<FinancialAccount>('/financial-accounts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
    },
  });
}

export function useUpdateFinancialAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateFinancialAccountBody }) =>
      api.patch<FinancialAccount>(`/financial-accounts/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
    },
  });
}

export function useDeleteFinancialAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Deleted>(`/financial-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
    },
  });
}

// ===================== Payment methods =====================
export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api.get<PaymentMethod[]>('/payment-methods'),
  });
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePaymentMethodBody) =>
      api.post<PaymentMethod>('/payment-methods', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePaymentMethodBody }) =>
      api.patch<PaymentMethod>(`/payment-methods/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Deleted>(`/payment-methods/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });
}

// ===================== Financial categories =====================
export function useFinancialCategories() {
  return useQuery({
    queryKey: ['financial-categories'],
    queryFn: () => api.get<FinancialCategory[]>('/financial-categories'),
  });
}

export function useCreateFinancialCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFinancialCategoryBody) =>
      api.post<FinancialCategory>('/financial-categories', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
    },
  });
}

export function useUpdateFinancialCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateFinancialCategoryBody }) =>
      api.patch<FinancialCategory>(`/financial-categories/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
    },
  });
}

export function useDeleteFinancialCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Deleted>(`/financial-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
    },
  });
}
