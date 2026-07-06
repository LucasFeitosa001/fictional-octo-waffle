import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type {
  AppointmentRow,
  AvailabilityResponse,
  CashRegisterRow,
  CompanyInfo,
  CreateAppointmentBody,
  Customer,
  DashboardOverview,
  OrderRow,
  Paginated,
  Professional,
  Service,
} from './types';

export function useDashboard(from: string, to: string) {
  return useQuery({
    queryKey: ['dashboard', from, to],
    queryFn: () =>
      api.get<DashboardOverview>('/dashboard', { from, to }),
  });
}

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
  imageUrl?: string | null;
  imageUrls?: string[];
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
    mutationFn: (body: { name: string; phone?: string }) =>
      api.post<Customer>('/customers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useProfessionals(page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['professionals', page, pageSize],
    queryFn: () =>
      api.get<Paginated<Professional>>('/professionals', { page, pageSize }),
  });
}

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
    mutationFn: ({ id, status }: { id: string; status: AppointmentRow['status'] }) =>
      api.patch<AppointmentRow>(`/appointments/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useOrders(status?: string) {
  return useQuery({
    queryKey: ['orders', status ?? null],
    queryFn: () =>
      api.get<Paginated<OrderRow>>('/orders', status ? { status } : undefined),
  });
}

export interface CreateOrderBody {
  customerId?: string;
  professionalId?: string;
  notes?: string;
}

export interface UpdateOrderBody {
  status?: 'open' | 'finished' | 'canceled';
  notes?: string;
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

export function useCashHistory() {
  return useQuery({
    queryKey: ['cash-registers'],
    queryFn: () => api.get<Paginated<CashRegisterRow>>('/cash-registers'),
  });
}

export function useOpenCash() {
  return useQuery({
    queryKey: ['cash-open'],
    queryFn: () => api.get<CashRegisterRow | null>('/cash-registers/open'),
  });
}

export function useCompany() {
  return useQuery({
    queryKey: ['company'],
    queryFn: () => api.get<CompanyInfo>('/companies/current'),
  });
}
