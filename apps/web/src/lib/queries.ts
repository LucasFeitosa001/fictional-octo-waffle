import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type {
  AppointmentRow,
  AvailabilityResponse,
  CashRegisterRow,
  CompanyInfo,
  ConsumePackageItemBody,
  CreateAppointmentBody,
  Customer,
  CustomerPackageDetail,
  DashboardOverview,
  OrderDetail,
  OrderRow,
  Paginated,
  Professional,
  ProductBatch,
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
  /** ISO date/datetime for the comanda. Defaults to "today" server-side. */
  date?: string;
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

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['order', id],
    enabled: Boolean(id),
    queryFn: () => api.get<OrderDetail>(`/orders/${id}`),
  });
}

export interface AddOrderItemBody {
  kind: 'service' | 'product';
  refId: string;
  professionalId?: string;
  quantity?: number;
  unitPrice: number;
  discount?: number;
}

export interface AddOrderDiscountBody {
  type: 'percent' | 'value';
  value: number;
  reason?: string;
}

export interface AddOrderPaymentBody {
  paymentMethodId?: string;
  accountId?: string;
  amount: number;
  dueDate?: string;
  description?: string;
}

/** Shared invalidation for every order-detail mutation. */
function invalidateOrder(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['order', id] });
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useAddOrderItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddOrderItemBody) => api.post<OrderRow>(`/orders/${id}/items`, body),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

export function useRemoveOrderItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.delete<OrderRow>(`/orders/${id}/items/${itemId}`),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

// =====================================================================
// Editar item (drawer com abas) — PATCH Dados/Lote, Auxiliares e
// Produtos consumidos. Endpoints novos do backend da Etapa 2.
// =====================================================================

export interface UpdateOrderItemBody {
  professionalId?: string;
  unitPrice?: number;
  quantity?: number;
  discount?: number;
  /** Aba "Lote" (itens de produto). null limpa o lote. */
  batchId?: string | null;
}

/** PATCH /orders/:id/items/:itemId — salva a aba "Dados" (+ batchId da aba "Lote"). */
export function useUpdateOrderItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: UpdateOrderItemBody }) =>
      api.patch<OrderDetail>(`/orders/${id}/items/${itemId}`, body),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

export interface AddOrderItemAuxiliaryBody {
  professionalId: string;
  discountFrom: 'establishment' | 'professional';
  valueType: 'percent' | 'value';
  value: number;
}

/** POST /orders/:id/items/:itemId/auxiliaries — adiciona rateio de comissão (não altera total). */
export function useAddOrderItemAuxiliary(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: AddOrderItemAuxiliaryBody }) =>
      api.post<OrderDetail>(`/orders/${id}/items/${itemId}/auxiliaries`, body),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

/** DELETE /orders/:id/items/:itemId/auxiliaries/:auxId. */
export function useRemoveOrderItemAuxiliary(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, auxId }: { itemId: string; auxId: string }) =>
      api.delete<OrderDetail>(`/orders/${id}/items/${itemId}/auxiliaries/${auxId}`),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

export interface AddConsumedProductBody {
  productId: string;
  quantity: number;
  unitValue?: number;
  batchId?: string;
  unit?: string;
  extraQuantity?: number;
}

/** Shared invalidation p/ consumo: além da comanda, mexe no estoque/lotes. */
function invalidateConsumed(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  invalidateOrder(queryClient, id);
  queryClient.invalidateQueries({ queryKey: ['products'] });
  queryClient.invalidateQueries({ queryKey: ['product-batches'] });
}

/** POST /orders/:id/items/:itemId/consumed-products — baixa estoque via InventoryMovement out. */
export function useAddConsumedProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: AddConsumedProductBody }) =>
      api.post(`/orders/${id}/items/${itemId}/consumed-products`, body),
    onSuccess: () => invalidateConsumed(queryClient, id),
  });
}

/** DELETE /orders/:id/items/:itemId/consumed-products/:consumedId — estorna (in). */
export function useRemoveConsumedProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, consumedId }: { itemId: string; consumedId: string }) =>
      api.delete(`/orders/${id}/items/${itemId}/consumed-products/${consumedId}`),
    onSuccess: () => invalidateConsumed(queryClient, id),
  });
}

/** GET /product-batches?productId= — lotes ativos primeiro, por validade. */
export function useProductBatches(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-batches', productId ?? null],
    enabled: Boolean(productId),
    queryFn: () =>
      api.get<ProductBatch[]>('/product-batches', productId ? { productId } : undefined),
  });
}

export function useAddOrderDiscount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddOrderDiscountBody) =>
      api.post<OrderRow>(`/orders/${id}/discounts`, body),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

/** POST /orders/:id/credit — abate saldo de crédito do cliente na comanda. */
export function useApplyOrderCredit(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      api.post<OrderRow>(`/orders/${id}/credit`, { amount }),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

/** DELETE /orders/:id/credit — remove o crédito aplicado (volta a R$0,00). */
export function useRemoveOrderCredit(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<OrderRow>(`/orders/${id}/credit`),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

/** POST /orders/:id/cashback — abate saldo de cashback do cliente na comanda. */
export function useApplyOrderCashback(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      api.post<OrderRow>(`/orders/${id}/cashback`, { amount }),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

/** DELETE /orders/:id/cashback — remove o cashback aplicado (volta a R$0,00). */
export function useRemoveOrderCashback(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<OrderRow>(`/orders/${id}/cashback`),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

export function useAddOrderPayment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddOrderPaymentBody) =>
      api.post<OrderRow>(`/orders/${id}/payments`, body),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

export function useReverseOrderPayment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) =>
      api.post<OrderRow>(`/orders/${id}/payments/${paymentId}/reverse`, {}),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

export function useFinishOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<OrderRow>(`/orders/${id}/finish`, {}),
    onSuccess: () => invalidateOrder(queryClient, id),
  });
}

export function useReopenOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<OrderRow>(`/orders/${id}/reopen`, {}),
    onSuccess: () => invalidateOrder(queryClient, id),
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
    // React Query proíbe queryFn retornar undefined; o backend devolve vazio
    // quando não há caixa aberto, então normalizamos para null.
    queryFn: async () =>
      (await api.get<CashRegisterRow | null>('/cash-registers/open')) ?? null,
  });
}

export function useCompany() {
  return useQuery({
    queryKey: ['company'],
    queryFn: () => api.get<CompanyInfo>('/companies/current'),
  });
}

// =====================================================================
// Customer package DETAIL (consumo/saldo). The list hooks live in
// ./queries/pacotes; these drive the per-package profile view.
// =====================================================================

/** Shared invalidation for package-detail mutations. */
function invalidatePackage(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['customer-package', id] });
  queryClient.invalidateQueries({ queryKey: ['customer-packages'] });
}

export function useCustomerPackage(id: string | undefined) {
  return useQuery({
    queryKey: ['customer-package', id],
    enabled: Boolean(id),
    queryFn: () => api.get<CustomerPackageDetail>(`/customer-packages/${id}`),
  });
}

export function useConsumePackageItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body?: ConsumePackageItemBody }) =>
      api.post<CustomerPackageDetail>(
        `/customer-packages/${id}/items/${itemId}/consume`,
        body ?? {},
      ),
    onSuccess: () => invalidatePackage(queryClient, id),
  });
}

export function useUndoPackageUsage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (usageId: string) =>
      api.delete<CustomerPackageDetail>(`/customer-packages/${id}/usages/${usageId}`),
    onSuccess: () => invalidatePackage(queryClient, id),
  });
}
