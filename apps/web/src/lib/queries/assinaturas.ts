import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { toastSuccess } from '../toast';

// =====================================================================
// Types — ASSINATURAS (memberships). Money fields are Decimal strings.
// =====================================================================

export type MembershipStatus = 'active' | 'canceled' | 'overdue';

export interface MembershipServiceItem {
  membershipPlanId: string;
  serviceId: string;
  quantityPerCycle: number;
  // Wave 4: grid de itens editável — preço/desconto/quantidade por linha.
  // Decimais chegam serializados como string (ou null quando não preenchidos).
  unitPrice?: string | null;
  discount?: string | null;
  quantity?: string | null;
  service?: { id: string; name: string };
}

export interface MembershipPlan {
  id: string;
  companyId: string;
  name: string;
  recurringPrice: string;
  intervalMonths: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  services: MembershipServiceItem[];
}

export interface CustomerMembership {
  id: string;
  companyId: string;
  customerId: string;
  membershipPlanId: string;
  status: MembershipStatus;
  nextDueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string };
  membershipPlan?: { id: string; name: string; recurringPrice: string };
}

export interface CreateMembershipPlanBody {
  name: string;
  recurringPrice: number;
  intervalMonths?: number;
  services: {
    serviceId: string;
    quantityPerCycle: number;
    unitPrice?: number;
    discount?: number;
    quantity?: number;
  }[];
}

export type UpdateMembershipPlanBody = Partial<CreateMembershipPlanBody>;

export interface CreateCustomerMembershipBody {
  customerId: string;
  membershipPlanId: string;
}

export interface UpdateCustomerMembershipBody {
  status?: MembershipStatus;
  nextDueDate?: string;
}

// =====================================================================
// Plans
// =====================================================================

export function useMembershipPlans() {
  return useQuery({
    queryKey: ['membership-plans'],
    queryFn: () => api.get<MembershipPlan[]>('/membership-plans'),
  });
}

export function useCreateMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMembershipPlanBody) =>
      api.post<MembershipPlan>('/membership-plans', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['membership-plans'] });
      toastSuccess('Plano criado');
    },
  });
}

export function useUpdateMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMembershipPlanBody }) =>
      api.patch<MembershipPlan>(`/membership-plans/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['membership-plans'] });
      toastSuccess('Plano salvo');
    },
  });
}

export function useDeleteMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/membership-plans/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['membership-plans'] });
      toastSuccess('Plano excluído');
    },
  });
}

// =====================================================================
// Customer memberships (subscribers)
// =====================================================================

export function useCustomerMemberships(status?: string) {
  return useQuery({
    queryKey: ['customer-memberships', status ?? null],
    queryFn: () =>
      api.get<CustomerMembership[]>('/customer-memberships', status ? { status } : undefined),
  });
}

export function useCreateCustomerMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCustomerMembershipBody) =>
      api.post<CustomerMembership>('/customer-memberships', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-memberships'] });
      toastSuccess('Assinatura criada');
    },
  });
}

export function useUpdateCustomerMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCustomerMembershipBody }) =>
      api.patch<CustomerMembership>(`/customer-memberships/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-memberships'] });
      toastSuccess('Assinatura salva');
    },
  });
}
