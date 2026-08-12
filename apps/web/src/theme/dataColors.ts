export const BUSINESS_COLORS = {
  sales: 'var(--sp-data-sales)',
  appointments: 'var(--sp-data-appointments)',
  orders: 'var(--sp-data-orders)',
  customers: 'var(--sp-data-customers)',
  services: 'var(--sp-data-services)',
  products: 'var(--sp-data-products)',
  stock: 'var(--sp-data-stock)',
  messages: 'var(--sp-data-messages)',
  reviews: 'var(--sp-data-reviews)',
  conversion: 'var(--sp-data-conversion)',
  income: 'var(--sp-data-income)',
  expense: 'var(--sp-data-expense)',
  receivable: 'var(--sp-data-receivable)',
  payable: 'var(--sp-data-payable)',
  balance: 'var(--sp-data-balance)',
} as const;

export const STATUS_COLORS = {
  success: 'var(--sp-status-success)',
  warning: 'var(--sp-status-warning)',
  danger: 'var(--sp-status-danger)',
  info: 'var(--sp-status-info)',
  neutral: 'var(--sp-status-neutral)',
} as const;

export const DATA_VIZ_PALETTE = [
  'var(--sp-chart-categorical-1)',
  'var(--sp-chart-categorical-2)',
  'var(--sp-chart-categorical-3)',
  'var(--sp-chart-categorical-4)',
  'var(--sp-chart-categorical-5)',
  'var(--sp-chart-categorical-6)',
  'var(--sp-chart-categorical-7)',
  'var(--sp-chart-categorical-8)',
  'var(--sp-chart-categorical-9)',
  'var(--sp-chart-categorical-10)',
  'var(--sp-chart-categorical-11)',
  'var(--sp-chart-categorical-12)',
] as const;

export const CHART_COLORS = {
  ink: '#585858',
  muted: '#64748b',
  canvas: '#ffffff',
  cream: '#f8fafc',
  grid: '#e2e8f0',
  axis: '#64748b',
  previousPeriod: '#94a3b8',
  heatmap: ['#eef0ff', '#d9dcff', '#aeb3ff', '#7d84ff', '#505afb'],
  appointmentFunnel: ['#5b21b6', '#7c3aed', '#a78bfa'],
} as const;

export function getCategoricalColor(key: string): string {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return DATA_VIZ_PALETTE[(hash >>> 0) % DATA_VIZ_PALETTE.length];
}

export function getAppointmentStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'confirmed':
    case 'arrived':
      return STATUS_COLORS.success;
    case 'in_progress':
      return BUSINESS_COLORS.appointments;
    case 'canceled':
    case 'cancelled':
    case 'no_show':
      return STATUS_COLORS.danger;
    case 'finished':
    case 'completed':
    case 'done':
      return STATUS_COLORS.neutral;
    case 'pending':
      return STATUS_COLORS.warning;
    default:
      return STATUS_COLORS.info;
  }
}
