import type {
  AppointmentStatus,
  OrderStatus,
  OrderItemKind,
  PaymentStatus,
  Customer,
  Professional as SharedProfessional,
  Service,
} from '@beautypass/shared';

/** API returns avatarUrl + birthday on professionals; extend the shared type. */
export interface Professional extends SharedProfessional {
  avatarUrl?: string | null;
  birthday?: string | null;
}

export interface CustomerTag {
  id: string;
  companyId: string;
  name: string;
}

export interface CustomerDependent {
  id: string;
  customerId: string;
  name: string;
  relationship?: string | null;
}

export interface CustomerSocialProfile {
  id: string;
  customerId: string;
  platform: string;
  url: string;
}

/** API returns secondaryPhone + birthday + P0 depth fields on customers. */
export interface CustomerFull extends Customer {
  secondaryPhone?: string | null;
  birthday?: string | null;
  cnpj?: string | null;
  rg?: string | null;
  avatarUrl?: string | null;
  referredById?: string | null;
  defaultDiscountPercent?: number | string | null;
  notificationsEnabled?: boolean | null;
  whatsappOptIn?: boolean | null;
  smsOptIn?: boolean | null;
  onlineAccessBlocked?: boolean | null;
  tags?: CustomerTag[];
  dependents?: CustomerDependent[];
  socialProfiles?: CustomerSocialProfile[];
}

/** One item in the customer's recent-services feed (GET /customers/:id/panel). */
export interface PanelServiceItem {
  source: 'appointment' | 'order';
  date: string;
  status: string;
  name: string | null;
  serviceId?: string;
  kind?: string;
  refId?: string;
  price: number;
}

/** GET /customers/:id/panel — real customer metrics. */
export interface CustomerPanel {
  customer: CustomerFull;
  faturamento: number;
  lastVisitAt: string | null;
  diasSemVir: number | null;
  debitosTotal: number;
  creditosSaldo: number;
  cashbackSaldo: number;
  pacotesEmAberto: number;
  ultimosServicos: PanelServiceItem[];
}

export interface CustomerDebtPayment {
  id: string;
  debtId: string;
  amount: string;
  paidAt: string;
  method?: string | null;
}

export interface CustomerDebt {
  id: string;
  companyId: string;
  customerId: string;
  amount: string;
  origin?: string | null;
  dueDate?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  payments: CustomerDebtPayment[];
}

export interface CustomerCredit {
  id: string;
  customerId: string;
  amount: string;
  reason?: string | null;
  createdAt: string;
}

export interface CustomerCashback {
  id: string;
  customerId: string;
  amount: string;
  expiresAt?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  createdAt: string;
}

/** GET /customers/:id/credits — credit + cashback ledger with balances. */
export interface CustomerCreditsResponse {
  credits: CustomerCredit[];
  cashback: CustomerCashback[];
  creditosSaldo: number;
  cashbackSaldo: number;
}

export type ChipColor = 'accent' | 'danger' | 'default' | 'success' | 'warning';

/** Status -> HeroUI Chip color (per spec, color by status). */
export const APPOINTMENT_STATUS_COLOR: Record<AppointmentStatus, ChipColor> = {
  scheduled: 'accent',
  confirmed: 'success',
  unconfirmed: 'warning',
  waiting: 'warning',
  in_progress: 'accent',
  done: 'success',
  finished: 'default',
  canceled: 'danger',
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, ChipColor> = {
  open: 'accent',
  finished: 'success',
  canceled: 'danger',
};

export interface DashboardOverview {
  period: { from: string | null; to: string | null };
  salesTotal: number;
  appointments: number;
  orders: number;
  finishedOrders: number;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Appointment as returned by the list endpoint (includes relations). */
export interface AppointmentRow {
  id: string;
  companyId: string;
  customerId?: string | null;
  professionalId?: string | null;
  status: AppointmentStatus;
  start: string;
  end: string;
  notes?: string | null;
  customer?: Customer | null;
  professional?: Professional | null;
  items?: { id: string; serviceId: string; price: string }[];
}

/** Order as returned by the list endpoint (includes customer). */
export interface OrderRow {
  id: string;
  companyId: string;
  number: number;
  customerId?: string | null;
  status: OrderStatus;
  grossTotal: string;
  discountTotal: string;
  netTotal: string;
  date: string;
  customer?: Customer | null;
}

/** One item of an order detail (GET /orders/:id) with resolved names. */
export interface OrderItemDetail {
  id: string;
  orderId: string;
  kind: OrderItemKind;
  refId: string;
  professionalId?: string | null;
  quantity: string;
  unitPrice: string;
  grossValue: string;
  discount: string;
  itemName: string | null;
  professionalName: string | null;
}

/** A manual discount applied to an order. */
export interface OrderDiscountDetail {
  id: string;
  orderId: string;
  type: 'percent' | 'value';
  value: string;
  reason?: string | null;
}

/** A payment registered on an order, with resolved method/account names. */
export interface OrderPaymentDetail {
  id: string;
  orderId: string;
  paymentMethodId?: string | null;
  accountId?: string | null;
  amount: string;
  dueDate?: string | null;
  paidAt?: string | null;
  status: PaymentStatus;
  description?: string | null;
  paymentMethodName: string | null;
  accountName: string | null;
}

/** One transition recorded in the order status history. */
export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  at: string;
  byUserId?: string | null;
  byUser?: { id: string; name: string } | null;
}

/** GET /orders/:id — enriched order detail. */
export interface OrderDetail {
  id: string;
  companyId: string;
  number: number;
  customerId?: string | null;
  professionalId?: string | null;
  status: OrderStatus;
  grossTotal: string;
  discountTotal: string;
  creditUsed: string;
  cashbackUsed: string;
  netTotal: string;
  notes?: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
  customer?: Customer | null;
  customerName: string | null;
  professionalName: string | null;
  items: OrderItemDetail[];
  discounts: OrderDiscountDetail[];
  payments: OrderPaymentDetail[];
  statusHistory: OrderStatusHistoryEntry[];
}

export interface CashRegisterRow {
  id: string;
  companyId: string;
  number: number;
  openingBalance: string;
  countedBalance?: string | null;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string | null;
}

export interface CompanyInfo {
  id: string;
  name: string;
  legalName?: string | null;
  cnpj?: string | null;
  logoUrl?: string | null;
  timezone: string;
  currency: string;
  active: boolean;
}

/** A single bookable time slot returned by GET /availability (UTC ISO). */
export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface AvailabilityResponse {
  date: string;
  serviceId: string;
  professionalId: string;
  slots: AvailabilitySlot[];
}

/** Body for POST /appointments. The backend computes end + pricing. */
export interface CreateAppointmentBody {
  customerId?: string;
  professionalId?: string;
  start: string;
  end?: string;
  notes?: string;
  items?: { serviceId: string; professionalId?: string }[];
}

export type { Service, Customer };
