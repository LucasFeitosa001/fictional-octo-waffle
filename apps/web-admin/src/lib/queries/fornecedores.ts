import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Paginated } from '../types';

// =====================================================================
// Types — Fornecedores (suppliers)
// =====================================================================

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  stateRegistration?: string | null;
  cnpj?: string | null;
  addressJson?: unknown;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierBody {
  name: string;
  email?: string;
  phone?: string;
  stateRegistration?: string;
  cnpj?: string;
  addressJson?: unknown;
  active?: boolean;
}

// =====================================================================
// Suppliers
// =====================================================================

export function useSuppliers(search?: string) {
  return useQuery({
    queryKey: ['suppliers', search ?? null],
    queryFn: () =>
      api.get<Paginated<Supplier>>('/suppliers', search ? { search } : undefined),
  });
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: ['supplier', id],
    enabled: Boolean(id),
    queryFn: () => api.get<Supplier>(`/suppliers/${id}`),
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SupplierBody) => api.post<Supplier>('/suppliers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<SupplierBody> }) =>
      api.patch<Supplier>(`/suppliers/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Supplier>(`/suppliers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}
