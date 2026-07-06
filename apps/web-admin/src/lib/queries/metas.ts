import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export type GoalKind = 'sales' | 'appointments' | 'customers' | 'commission';
export type ScopeType = 'service' | 'product' | 'category' | 'all';

export interface Goal {
  id: string;
  companyId: string;
  period: string;
  kind: GoalKind;
  scopeType: ScopeType;
  scopeId?: string | null;
  target: number;
  actual: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalBody {
  period: string;
  kind: GoalKind;
  scopeType: ScopeType;
  scopeId?: string;
  target: number;
}

export type UpdateGoalBody = Partial<CreateGoalBody>;

export function useGoals(period?: string) {
  return useQuery({
    queryKey: ['goals', period ?? null],
    queryFn: () => api.get<Goal[]>('/goals', period ? { period } : undefined),
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGoalBody) => api.post<Goal>('/goals', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateGoalBody }) =>
      api.patch<Goal>(`/goals/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/goals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });
}
