'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type {
  AppointmentRow,
  AvailabilityResponse,
  CompanyInfo,
  CreateAppointmentBody,
  Customer,
  CustomerFull,
  DashboardOverview,
  OrderRow,
  Paginated,
  Professional,
  Service,
} from './types';

// ===================== Dashboard =====================
export function useDashboard(from: string, to: string) {
  return useQuery({
    queryKey: ['dashboard', from, to],
    queryFn: () => api.get<DashboardOverview>('/dashboard', { from, to }),
  });
}

// ===================== Services =====================
/** Service as returned by the API (extends shared type with extra fields). */
export interface ServiceRow extends Service {
  cashbackPercent?: string;
  favorite?: boolean;
  visible?: boolean;
}

export interface ServiceBody {
  name: string;
  categoryId?: string;
  price: number;
  durationMin: number;
  description?: string;
  cashbackPercent?: number;
  onlineBookable?: boolean;
  favorite?: boolean;
  visible?: boolean;
  active?: boolean;
}

export function useServices(categoryId?: string) {
  return useQuery({
    queryKey: ['services', categoryId ?? null],
    queryFn: () =>
      api.get<Paginated<ServiceRow>>('/services', categoryId ? { categoryId } : undefined),
  });
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ['service-categories'],
    queryFn: () =>
      api.get<{ id: string; name: string; displayOrder: number }[]>('/service-categories'),
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ServiceBody) => api.post<ServiceRow>('/services', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ServiceBody> }) =>
      api.patch<ServiceRow>(`/services/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ServiceRow>(`/services/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

// ===================== Customers =====================
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

export function useCustomers(search: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['customers', search, page, pageSize],
    queryFn: () =>
      api.get<Paginated<Customer>>('/customers', {
        search: search || undefined,
        page,
        pageSize,
      }),
  });
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

// ===================== Professionals (profissionais) =====================
export interface ProfessionalBody {
  name: string;
  nickname?: string;
  phone?: string;
  profession?: string;
  avatarUrl?: string | null;
  birthday?: string;
  onlineBookable?: boolean;
  active?: boolean;
}

export function useProfessionals(page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['professionals', page, pageSize],
    queryFn: () =>
      api.get<Paginated<Professional>>('/professionals', { page, pageSize }),
  });
}

export function useCreateProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfessionalBody) => api.post<Professional>('/professionals', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professionals'] }),
  });
}

export function useUpdateProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ProfessionalBody> }) =>
      api.patch<Professional>(`/professionals/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professionals'] }),
  });
}

export function useDeleteProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Professional>(`/professionals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professionals'] }),
  });
}

// ===================== Appointments (agenda) =====================
export function useAppointments(filters: {
  from?: string;
  to?: string;
  professionalId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['appointments', filters],
    queryFn: () =>
      api.get<Paginated<AppointmentRow>>('/appointments', {
        from: filters.from,
        to: filters.to,
        professionalId: filters.professionalId,
        status: filters.status,
      }),
  });
}

export function useAvailability(
  serviceId: string | undefined,
  professionalId: string | undefined,
  date: string | undefined,
) {
  const enabled = Boolean(serviceId && professionalId && date);
  return useQuery({
    queryKey: ['availability', serviceId, professionalId, date],
    enabled,
    queryFn: () =>
      api.get<AvailabilityResponse>('/availability', {
        serviceId: serviceId!,
        professionalId: professionalId!,
        date: date!,
      }),
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAppointmentBody) =>
      api.post<AppointmentRow>('/appointments', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSetAppointmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: AppointmentRow['status']; reason?: string }) =>
      api.patch<AppointmentRow>(`/appointments/${id}/status`, { status, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSuggestAppointment() {
  return useMutation({
    mutationFn: ({ id, suggestion }: { id: string; suggestion: string }) =>
      api.post<{ ok: true }>(`/appointments/${id}/suggest`, { suggestion }),
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; start?: string; end?: string; professionalId?: string; notes?: string }) =>
      api.patch<AppointmentRow>(`/appointments/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

// ===================== Orders (comandas) =====================
export interface CreateOrderBody {
  customerId?: string;
  professionalId?: string;
  notes?: string;
}

export interface UpdateOrderBody {
  status?: 'open' | 'finished' | 'canceled';
  notes?: string;
}

export function useOrders(status?: string) {
  return useQuery({
    queryKey: ['orders', status ?? null],
    queryFn: () =>
      api.get<Paginated<OrderRow>>('/orders', status ? { status } : undefined),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrderBody) => api.post<OrderRow>('/orders', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOrderBody }) =>
      api.patch<OrderRow>(`/orders/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<OrderRow>(`/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ===================== Company =====================
export function useCompany() {
  return useQuery({
    queryKey: ['company'],
    queryFn: () => api.get<CompanyInfo>('/companies/current'),
  });
}

// ===================== Booking link (marketing) =====================
export interface BookingLink {
  id: string;
  companyId: string;
  slug: string;
  active: boolean;
  configJson?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBookingLinkBody {
  slug?: string;
  active?: boolean;
}

export function useBookingLink() {
  return useQuery({
    queryKey: ['booking-link'],
    queryFn: () => api.get<BookingLink>('/booking-link'),
  });
}

export function useUpdateBookingLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateBookingLinkBody) =>
      api.patch<BookingLink>('/booking-link', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-link'] });
    },
  });
}
