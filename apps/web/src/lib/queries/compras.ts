import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Paginated } from '../types';

// =====================================================================
// Types — CONTROLE / Compras (pedidos a fornecedor + entrada de estoque)
// Money/decimal fields come from the API as Decimal strings.
// =====================================================================

/**
 * Onda 7: Purchase.status é uma coluna real. Compras nascem "lancada" (já dão
 * entrada no estoque). Mantemos a união conhecida, mas aceitamos qualquer
 * string persistida para não quebrar com dados legados.
 */
export type PurchaseStatus = 'lancada' | 'cancelada' | 'rascunho' | (string & {});

export interface PurchaseRow {
  id: string;
  companyId: string;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  accountId?: string | null;
  paymentMethodId?: string | null;
  /** Número sequencial por empresa (Onda 7). Nulo em compras legadas. */
  number?: number | null;
  freight?: string;
  discount?: string;
  notes?: string | null;
  total: string;
  date: string;
  itemsCount: number;
  status: PurchaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItemDetail {
  id: string;
  purchaseId: string;
  productId: string;
  quantity: string;
  unitCost: string;
  /** Onda 7: desconto e total da linha (Decimal strings). */
  discount: string;
  total: string;
  product?: { id: string; name: string; unit?: string | null } | null;
}

export interface PurchaseDetail {
  id: string;
  companyId: string;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  accountId?: string | null;
  account?: { id: string; name: string } | null;
  paymentMethodId?: string | null;
  paymentMethod?: { id: string; name: string } | null;
  number?: number | null;
  freight: string;
  discount: string;
  notes?: string | null;
  total: string;
  date: string;
  status: PurchaseStatus;
  items: PurchaseItemDetail[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItemBody {
  productId: string;
  quantity: number;
  unitCost: number;
  discount?: number;
}

export interface CreatePurchaseBody {
  supplierId?: string;
  date?: string;
  items: PurchaseItemBody[];
  freight?: number;
  discount?: number;
  accountId?: string;
  paymentMethodId?: string;
  notes?: string;
}

export type UpdatePurchaseBody = Partial<CreatePurchaseBody>;

export interface ImportedXmlRow {
  id: string;
  companyId: string;
  accessKey?: string | null;
  fileUrl?: string | null;
  status: string;
  purchaseId?: string | null;
  createdAt: string;
}

export interface ImportedXmlsResponse {
  data: ImportedXmlRow[];
  /** true (Onda 7: model ImportedXml existe e é listado de verdade). */
  available: boolean;
}

// =====================================================================
// Purchases
// =====================================================================

export function usePurchases(search?: string) {
  return useQuery({
    queryKey: ['purchases', search ?? null],
    queryFn: () =>
      api.get<Paginated<PurchaseRow>>(
        '/purchases',
        search ? { search } : undefined,
      ),
  });
}

export function usePurchase(id: string | undefined) {
  return useQuery({
    queryKey: ['purchase', id],
    enabled: Boolean(id),
    queryFn: () => api.get<PurchaseDetail>(`/purchases/${id}`),
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePurchaseBody) =>
      api.post<PurchaseDetail>('/purchases', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      // A compra dá entrada no estoque: invalida produtos também.
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePurchaseBody }) =>
      api.patch<PurchaseDetail>(`/purchases/${id}`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['purchase', vars.id] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeletePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/purchases/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

/**
 * Aba "XMLs Importados": lista os ImportedXml reais da empresa (Onda 7).
 * Pode vir vazio — a UI mostra um estado vazio honesto.
 */
export function useImportedXmls() {
  return useQuery({
    queryKey: ['purchase-xmls'],
    queryFn: () => api.get<ImportedXmlsResponse>('/purchases/xmls'),
  });
}
