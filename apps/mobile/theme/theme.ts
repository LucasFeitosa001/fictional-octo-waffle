// Salonpass feminino mobile admin theme: amarelo (CTA) + preto, fundo creme.

export const colors = {
  primary: '#E6B23C', // amarelo principal (CTA)
  primaryDark: '#C9962F', // amarelo escuro destaque
  primaryLight: '#F3E7D6', // creme claro
  background: '#F2EADF', // fundo creme
  surface: '#FFFFFF',
  border: '#E0D6C6', // creme/bege claro
  text: '#111111', // preto
  textMuted: '#70757A', // cinza médio
  white: '#FFFFFF',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
} as const;

// Status badge colors (Agendado, Confirmado, Cancelado, Finalizado, Ativo, Vencido...).
export const statusColors: Record<string, { bg: string; fg: string }> = {
  scheduled: { bg: '#F3E7D6', fg: '#A77B1E' }, // Agendado
  confirmed: { bg: '#DCFCE7', fg: '#15803D' }, // Confirmado
  unconfirmed: { bg: '#FEF3C7', fg: '#B45309' }, // Não confirmado
  waiting: { bg: '#E0F2FE', fg: '#0369A1' }, // Aguardando
  in_progress: { bg: '#FAE8FF', fg: '#A21CAF' }, // Em atendimento
  done: { bg: '#E0E7FF', fg: '#3730A3' }, // Atendido
  finished: { bg: '#DCFCE7', fg: '#166534' }, // Finalizado
  canceled: { bg: '#FEE2E2', fg: '#B91C1C' }, // Cancelado
  open: { bg: '#F3E7D6', fg: '#A77B1E' }, // Aberta / Caixa aberto
  closed: { bg: '#F3F4F6', fg: '#374151' }, // Fechado
  active: { bg: '#DCFCE7', fg: '#166534' }, // Ativo
  overdue: { bg: '#FEE2E2', fg: '#B91C1C' }, // Vencido
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
} as const;
