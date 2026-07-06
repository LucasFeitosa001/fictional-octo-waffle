import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ===================== Types =====================
export type ScopeType = 'service' | 'product' | 'category' | 'all';
export type DiscountType = 'percent' | 'value';

export interface Promotion {
  id: string;
  companyId: string;
  name: string;
  scopeType: ScopeType;
  scopeId?: string | null;
  discountType: DiscountType;
  discountValue: string;
  validFrom?: string | null;
  validTo?: string | null;
  usageLimit?: number | null;
  appliesOnline: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CashbackRule {
  id: string;
  companyId: string;
  scopeType: ScopeType;
  scopeId?: string | null;
  percent: string;
  validityDays: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRow {
  id: string;
  companyId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  customer?: { id: string; name: string } | null;
  professional?: { id: string; name: string } | null;
  service?: { id: string; name: string } | null;
}

export interface ReviewsResponse {
  data: ReviewRow[];
  count: number;
  average: number;
  distribution: Record<string, number>;
}

export interface CreatePromotionBody {
  name: string;
  scopeType: ScopeType;
  scopeId?: string;
  discountType: DiscountType;
  discountValue: number;
  validFrom?: string;
  validTo?: string;
  usageLimit?: number;
  appliesOnline?: boolean;
}

export type UpdatePromotionBody = Partial<CreatePromotionBody>;

export interface CreateCashbackRuleBody {
  scopeType: ScopeType;
  scopeId?: string;
  percent: number;
  validityDays?: number;
  active?: boolean;
}

export type UpdateCashbackRuleBody = Partial<CreateCashbackRuleBody>;

// ===================== Promotions =====================
export function usePromotions() {
  return useQuery({
    queryKey: ['promotions'],
    queryFn: () => api.get<Promotion[]>('/promotions'),
  });
}

export function useCreatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePromotionBody) => api.post<Promotion>('/promotions', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  });
}

export function useUpdatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePromotionBody }) =>
      api.patch<Promotion>(`/promotions/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  });
}

export function useDeletePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/promotions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  });
}

// ===================== Reviews =====================
export function useReviews(from?: string, to?: string) {
  return useQuery({
    queryKey: ['reviews', from ?? null, to ?? null],
    queryFn: () =>
      api.get<ReviewsResponse>('/reviews', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}

// ===================== Cashback rules =====================
export function useCashbackRules() {
  return useQuery({
    queryKey: ['cashback-rules'],
    queryFn: () => api.get<CashbackRule[]>('/cashback-rules'),
  });
}

export function useCreateCashbackRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCashbackRuleBody) =>
      api.post<CashbackRule>('/cashback-rules', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cashback-rules'] }),
  });
}

export function useUpdateCashbackRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCashbackRuleBody }) =>
      api.patch<CashbackRule>(`/cashback-rules/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cashback-rules'] }),
  });
}

export function useDeleteCashbackRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/cashback-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cashback-rules'] }),
  });
}
