// Tema do Silvia Hair ERP mobile (app das funcionárias): rosa sofisticado +
// lilás suave sobre fundo claro — mesma identidade do desktop.

export const silvia = {
  brand: '#E1478D',
  brandDark: '#C92D72',
  brandSoft: '#FCE7F1',
  accent: '#8B5CF6',
  accentSoft: '#EFEAFB',
  gold: '#C9A15E',
  paper: '#FAF8FB',
  surface: '#FFFFFF',
  border: '#E8E6EE',
  ink: '#1F2028',
  inkMuted: '#6B6875',
  inkFaint: '#A7A4B0',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#0369A1',
  infoSoft: '#E0F2FE',
} as const;

export const silviaStatusColors: Record<string, { bg: string; fg: string }> = {
  agendado: { bg: silvia.brandSoft, fg: silvia.brandDark },
  confirmado: { bg: silvia.successSoft, fg: '#15803D' },
  em_atendimento: { bg: silvia.accentSoft, fg: '#6D28D9' },
  finalizado: { bg: silvia.infoSoft, fg: silvia.info },
  cancelado: { bg: silvia.dangerSoft, fg: '#B91C1C' },
};
