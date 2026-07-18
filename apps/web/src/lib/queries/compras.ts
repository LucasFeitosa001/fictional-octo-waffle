import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Paginated } from '../types';

// =====================================================================
// Types — CONTROLE / Compras (pedidos a fornecedor + entrada de estoque)
// Money/decimal fields come from the API as Decimal strings.
// =====================================================================

/**
 * O schema não persiste status de compra. Toda compra já dá entrada no estoque
 * ao ser criada, então a API expõe um status sintético fixo: "lancada".
 */
export type PurchaseStatus = 'lancada';

export interface PurchaseRow {
  id: string;
  companyId: string;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  accountId?: string | null;
  paymentMethodId?: string | null;
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

export interface ImportedXmlsResponse {
  data: unknown[];
  /** false enquanto não houver model ImportedXml no schema. */
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
 * Aba "XMLs Importados": não há model ImportedXml no schema, então a API
 * responde `available: false`. A UI mostra um estado honesto de "em breve".
 */
export function useImportedXmls() {
  return useQuery({
    queryKey: ['purchase-xmls'],
    queryFn: () => api.get<ImportedXmlsResponse>('/purchases/xmls'),
  });
}
