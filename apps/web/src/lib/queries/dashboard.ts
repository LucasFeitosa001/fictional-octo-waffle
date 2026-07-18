import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

/**
 * Dashboard (Painel) data — one aggregated call for every widget.
 *
 * Backend: GET /dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD
 * - JwtAuthGuard, escopo por companyId, no fuso da empresa.
 * - from/to omitidos => últimos 30 dias terminando hoje.
 * - Período anterior = janela de mesmo tamanho imediatamente antes.
 * - Dinheiro em number BRL (Decimal->Number).
 * - Estados vazios honestos: arrays vazios quando não há dados.
 */

export interface DashboardPeriod {
  from: string;
  to: string;
  timezone: string;
}

export interface DeltaValue {
  valor: number;
  deltaPct: number;
}

export interface ComandasCount {
  valor: number;
  taxaConversao: number;
}

export interface TendenciaVisitasPoint {
  date: string;
  agendamentos: number;
  comandas: number;
}

export interface StatusSlice {
  status: string;
  count: number;
  pct: number;
}

export interface ComparacaoPeriodos {
  anterior: number;
  atual: number;
}

export interface ProfessionalAtendimento {
  professionalId: string | null;
  name: string;
  servicos: number;
  receita: number;
  pct: number;
}

export interface CategoriaVenda {
  categoria: string;
  valor: number;
  pct: number;
}

export interface Funil {
  todos: number;
  confirmados: number;
  faturados: number;
}

export interface OcupacaoProfissional {
  professionalId: string;
  name: string;
  pct: number;
}

export interface MapaCalor {
  hours: number[];
  weekdays: number[];
  matrix: number[][];
  max: number;
}

export interface Dashboard {
  period: DashboardPeriod;
  vendasTotais: DeltaValue;
  vendasDia: number;
  agendamentosCount: DeltaValue;
  comandasCount: ComandasCount;
  tendenciaVisitas: TendenciaVisitasPoint[];
  agendamentosPorStatus: StatusSlice[];
  ticketMedio: DeltaValue;
  comparacaoPeriodos: ComparacaoPeriodos;
  atendimentosPorProfissional: ProfessionalAtendimento[];
  vendasPorCategoria: CategoriaVenda[];
  funil: Funil;
  ocupacaoAgenda: OcupacaoProfissional[];
  mapaCalor: MapaCalor;
}

export function useDashboard(from: string, to: string) {
  return useQuery({
    queryKey: ['dashboard', from, to],
    queryFn: () =>
      api.get<Dashboard>('/dashboard', {
        from: from || undefined,
        to: to || undefined,
      }),
  });
}
