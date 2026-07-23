import { BUSINESS_COLORS, CHART_COLORS } from './dataColors';

export interface ThemeColors {
  sales: string;
  appointments: string;
  orders: string;
  customers: string;
  services: string;
  products: string;
  stock: string;
  messages: string;
  reviews: string;
  conversion: string;
  income: string;
  expense: string;
  receivable: string;
  payable: string;
  balance: string;
  previousPeriod: string;
  ink: string;
  chartGrid: string;
  chartAxis: string;
}

const DATA_COLORS: ThemeColors = {
  ...BUSINESS_COLORS,
  previousPeriod: CHART_COLORS.previousPeriod,
  ink: CHART_COLORS.ink,
  chartGrid: CHART_COLORS.grid,
  chartAxis: CHART_COLORS.axis,
};

export function useThemeColors(): ThemeColors {
  return DATA_COLORS;
}
