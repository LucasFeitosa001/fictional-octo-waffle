// Shared domain TS types used across api/mobile/web.
import type {
  AppointmentStatus,
  OrderStatus,
  PaymentStatus,
  CashRegisterStatus,
  AuthProvider,
  OrderItemKind,
} from './enums';

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

export interface AuthUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  provider: AuthProvider;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface Company {
  id: string;
  name: string;
  legalName?: string | null;
  cnpj?: string | null;
  logoUrl?: string | null;
  timezone: string;
  currency: string;
  active: boolean;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  nickname?: string | null;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  active: boolean;
}

export interface Professional {
  id: string;
  companyId: string;
  name: string;
  nickname?: string | null;
  phone?: string | null;
  profession?: string | null;
  onlineBookable: boolean;
  notifyWhatsapp: boolean;
  active: boolean;
}

export interface Service {
  id: string;
  companyId: string;
  categoryId?: string | null;
  name: string;
  price: string; // Decimal serialized
  durationMin: number;
  description?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  onlineBookable: boolean;
  active: boolean;
}

export interface Appointment {
  id: string;
  companyId: string;
  customerId?: string | null;
  professionalId?: string | null;
  status: AppointmentStatus;
  start: string;
  end: string;
  notes?: string | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  kind: OrderItemKind;
  refId: string;
  professionalId?: string | null;
  quantity: string;
  unitPrice: string;
  grossValue: string;
  discount: string;
}

export interface Order {
  id: string;
  companyId: string;
  number: number;
  customerId?: string | null;
  status: OrderStatus;
  grossTotal: string;
  discountTotal: string;
  netTotal: string;
  date: string;
  items?: OrderItem[];
}

export interface CashRegister {
  id: string;
  companyId: string;
  number: number;
  openingBalance: string;
  countedBalance?: string | null;
  status: CashRegisterStatus;
  openedAt: string;
  closedAt?: string | null;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface PaymentSummary {
  status: PaymentStatus;
  amount: string;
}
