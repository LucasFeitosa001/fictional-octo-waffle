// Shared domain enums (mirror prisma enums; UI/copy in PT-BR maps via labels).

export const AppointmentStatus = {
  scheduled: 'scheduled',
  confirmed: 'confirmed',
  unconfirmed: 'unconfirmed',
  waiting: 'waiting',
  in_progress: 'in_progress',
  done: 'done',
  finished: 'finished',
  canceled: 'canceled',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const OrderStatus = {
  open: 'open',
  finished: 'finished',
  canceled: 'canceled',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  pending: 'pending',
  paid: 'paid',
  reversed: 'reversed',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const CashRegisterStatus = {
  open: 'open',
  closed: 'closed',
} as const;
export type CashRegisterStatus = (typeof CashRegisterStatus)[keyof typeof CashRegisterStatus];

export const AuthProvider = {
  local: 'local',
  google: 'google',
  apple: 'apple',
  phone: 'phone',
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const OrderItemKind = {
  service: 'service',
  product: 'product',
} as const;
export type OrderItemKind = (typeof OrderItemKind)[keyof typeof OrderItemKind];

// PT-BR labels for status badges (status with colors per spec).
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  unconfirmed: 'Não confirmado',
  waiting: 'Aguardando',
  in_progress: 'Em atendimento',
  done: 'Atendido',
  finished: 'Finalizado',
  canceled: 'Cancelado',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  open: 'Aberta',
  finished: 'Finalizada',
  canceled: 'Cancelada',
};
