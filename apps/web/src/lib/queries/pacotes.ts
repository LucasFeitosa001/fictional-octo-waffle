import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { toastSuccess } from '../toast';

// =====================================================================
// Types — PACOTES. Money/decimal fields are Decimal strings from the API.
// =====================================================================

export type PackageStatus = 'active' | 'expired' | 'finished';

export interface PackageTemplateItem {
  id: string;
  templateId: string;
  serviceId: string;
  sessions: number;
  service?: { id: string; name: string };
}

export interface PackageTemplate {
  id: string;
  companyId: string;
  name: string;
  price: string;
  validityDays: number;
  discount: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  items: PackageTemplateItem[];
}

export interface CustomerPackageItem {
  id: string;
  customerPackageId: string;
  serviceId: string;
  sessionsTotal: number;
  sessionsUsed: number;
  service?: { id: string; name: string };
}

export interface CustomerPackage {
  id: string;
  companyId: string;
  customerId: string;
  templateId?: string | null;
  number: number;
  price: string;
  status: PackageStatus;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string };
  template?: { id: string; name: string } | null;
  items: CustomerPackageItem[];
  // computed
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  isExpired: boolean;
}

export interface CustomerPackageList {
  data: CustomerPackage[];
  total: number;
}

export interface CreatePackageTemplateBody {
  name: string;
  price: number;
  validityDays?: number;
  discount?: number;
  items: { serviceId: string; sessions: number }[];
}

export type UpdatePackageTemplateBody = Partial<CreatePackageTemplateBody>;

export interface CreateCustomerPackageBody {
  customerId: string;
  templateId?: string;
  price?: number;
}

// =====================================================================
// Templates
// =====================================================================

export function usePackageTemplates() {
  return useQuery({
    queryKey: ['package-templates'],
    queryFn: () => api.get<PackageTemplate[]>('/package-templates'),
  });
}

export function useCreatePackageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePackageTemplateBody) =>
      api.post<PackageTemplate>('/package-templates', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['package-templates'] });
      toastSuccess('Pacote criado');
    },
  });
}

export function useUpdatePackageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePackageTemplateBody }) =>
      api.patch<PackageTemplate>(`/package-templates/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['package-templates'] });
      toastSuccess('Pacote salvo');
    },
  });
}

export function useDeletePackageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/package-templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['package-templates'] });
      toastSuccess('Pacote excluído');
    },
  });
}

// =====================================================================
// Customer packages (sold)
// =====================================================================

export function useCustomerPackages(filters: { status?: string; customerId?: string } = {}) {
  return useQuery({
    queryKey: ['customer-packages', filters],
    queryFn: () =>
      api.get<CustomerPackageList>('/customer-packages', {
        status: filters.status || undefined,
        customerId: filters.customerId || undefined,
      }),
  });
}

export function useCustomerPackage(id: string | undefined) {
  return useQuery({
    queryKey: ['customer-package', id],
    enabled: Boolean(id),
    queryFn: () => api.get<CustomerPackage>(`/customer-packages/${id}`),
  });
}

export function useSellPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCustomerPackageBody) =>
      api.post<CustomerPackage>('/customer-packages', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-packages'] });
      toastSuccess('Pacote vendido');
    },
  });
}

export function useDeleteCustomerPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/customer-packages/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-packages'] });
      toastSuccess('Pacote removido');
    },
  });
}
