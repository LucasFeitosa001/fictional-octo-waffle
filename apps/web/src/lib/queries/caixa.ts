import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { toastSuccess } from '../toast';
import type { CashRegisterRow, Paginated } from '../types';

// ===================== Tipos =====================

export interface CashUser {
  id: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  image?: string | null;
}

export interface CashMovementRow {
  id: string;
  type: 'in' | 'out';
  amount: string;
  paymentMethodId?: string | null;
  paymentMethod?: { id: string; name: string } | null;
  /** 'sangria' | 'suprimento' | 'payment' | conta relacionada. */
  refType?: string | null;
  refId?: string | null;
  at: string;
}

/** Conferência de caixa consolidada (números vindos do backend). */
export interface CashSummary {
  openingBalance: number;
  dinheiro: number;
  credito: number;
  pix: number;
  outros: number;
  byMethod: { name: string; total: number }[];
  suprimentos: number;
  sangrias: number;
  movements: number;
  saldoEmCaixa: number;
  totalPago: number;
}

export interface CashRegisterDetail extends CashRegisterRow {
  responsibleUser?: CashUser | null;
  movements: CashMovementRow[];
  summary: CashSummary;
}

export interface CashHistoryRow extends CashRegisterRow {
  responsibleUser?: CashUser | null;
  /** Quem FECHOU o caixa. Pode ser diferente de quem abriu. */
  closedByUser?: CashUser | null;
}

export interface OpenCashBody {
  openingBalance?: number;
  responsibleUserId?: string;
}

export interface CloseCashResult extends CashRegisterRow {
  expectedBalance: number;
  divergence: number;
}

export interface MovementBody {
  type: 'in' | 'out';
  amount: number;
  paymentMethodId?: string;
  refType?: string;
  refId?: string;
}

// ===================== Queries =====================

/** Histórico de caixas (imutável), com o responsável pela abertura. */
export function useCashRegisters() {
  return useQuery({
    queryKey: ['cash-registers'],
    queryFn: () => api.get<Paginated<CashHistoryRow>>('/cash-registers'),
  });
}

/** Todos os caixas abertos, com movimentos e conferência consolidada. */
export function useOpenedCashRegisters() {
  return useQuery({
    queryKey: ['cash-opened'],
    queryFn: () => api.get<CashRegisterDetail[]>('/cash-registers/opened'),
  });
}

export function useCashRegisterDetail(id: string | null) {
  return useQuery({
    queryKey: ['cash-detail', id],
    enabled: Boolean(id),
    queryFn: () => api.get<CashRegisterDetail>(`/cash-registers/${id}`),
  });
}

// ===================== Mutations =====================

function invalidateCash(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['cash-registers'] });
  qc.invalidateQueries({ queryKey: ['cash-open'] });
  qc.invalidateQueries({ queryKey: ['cash-opened'] });
  qc.invalidateQueries({ queryKey: ['cash-detail'] });
}

export function useOpenCashRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OpenCashBody) =>
      api.post<CashRegisterRow>('/cash-registers/open', body),
    onSuccess: () => {
      invalidateCash(qc);
      toastSuccess('Caixa aberto');
    },
  });
}

export function useCloseCashRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      countedBalance,
      note,
      // Fechamento costuma ser feito no dia seguinte — sem isso o backend grava
      // sempre a data/hora do request.
      closedAt,
    }: {
      id: string;
      countedBalance: number;
      note?: string;
      closedAt?: string;
    }) =>
      api.post<CloseCashResult>(`/cash-registers/${id}/close`, {
        countedBalance,
        note,
        ...(closedAt ? { closedAt } : {}),
      }),
    onSuccess: () => {
      invalidateCash(qc);
      toastSuccess('Caixa fechado');
    },
  });
}

export function useCashMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MovementBody }) =>
      api.post<CashMovementRow>(`/cash-registers/${id}/movements`, body),
    onSuccess: () => {
      invalidateCash(qc);
      toastSuccess('Movimentação registrada');
    },
  });
}
