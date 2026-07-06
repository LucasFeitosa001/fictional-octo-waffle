import type {
  AppointmentStatus,
  OrderStatus,
  Customer,
  Professional as SharedProfessional,
  Service,
} from '@beautypass/shared';

/** API returns avatarUrl + birthday on professionals; extend the shared type. */
export interface Professional extends SharedProfessional {
  avatarUrl?: string | null;
  birthday?: string | null;
}

/** API returns secondaryPhone + birthday on customers; extend the shared type. */
export interface CustomerFull extends Customer {
  secondaryPhone?: string | null;
  birthday?: string | null;
  cnpj?: string | null;
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
