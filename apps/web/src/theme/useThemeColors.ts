/**
 * Cores de GRÁFICO fixas do Belasis (data-viz). Os gráficos (recharts) usam a
 * paleta real do belasis.app INDEPENDENTE do tema de UI — só a interface
 * (sidebar, botões, badges) segue o tema via tokens `--sp-*`. Assim os gráficos
 * ficam idênticos ao Belasis em qualquer tema. Paleta extraída do HTML/JS do /wow.
 *
 * (Mantém o nome/shape `useThemeColors` por compatibilidade com os call-sites.)
 */
export interface ThemeColors {
  primary: string;
  primaryStrong: string;
  pink: string;
  ink: string;
  muted: string;
  canvas: string;
  cream: string;
  chartGrid: string;
  chartAxis: string;
  /** Paleta categórica do Belasis (pizzas/donuts/barras multi-série). */
  palette: string[];
}

const BELASIS_CHART: ThemeColors = {
  primary: '#505afb', // azul principal (barras / áreas / single-series)
  primaryStrong: '#3f47c9',
  pink: '#f2637b', // rosa/vermelho secundário (comandas)
  ink: '#585858', // texto de rótulo dos gráficos
  muted: '#999999',
  canvas: '#ffffff',
  cream: '#f5f5f7',
  chartGrid: '#f0f0f0', // grid do recharts
  chartAxis: '#999999',
  // paleta categórica do Belasis (antd/G2)
  palette: ['#505afb', '#2fc25b', '#ffbb28', '#ff4d4f', '#1890ff', '#8543e0', '#13c2c2', '#f2637b'],
};

export function useThemeColors(): ThemeColors {
  return BELASIS_CHART;
}
