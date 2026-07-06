import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { CustomerFull } from '../types';

export interface CustomerBody {
  name: string;
  nickname?: string;
  phone?: string;
  secondaryPhone?: string;
  email?: string;
  birthday?: string;
  cpf?: string;
  active?: boolean;
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<CustomerFull>(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}
