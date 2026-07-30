import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { useDashboard, type Dashboard } from '../lib/queries/dashboard';
import { useThemeColors } from '../theme/useThemeColors';
import { getCategoricalColor } from '../theme/dataColors';
import { formatMoney, formatNumber } from '../lib/format';
import {
  IconArrowUp,
  IconArrowDown,
  IconSparkles,
  IconClock,
  IconUsers,
} from '../components/icons';

/**
 * Área de IA → DADOS (estudo 62).
 *
 * Tudo vem de UMA chamada que já existia (`GET /dashboard`), escopada por
 * empresa e no fuso dela. Nada aqui é gerado por modelo: as "leituras" são
 * CÁLCULO em cima desses números, e a tela diz isso com essas palavras — passar
 * conta por IA seria mentir para o dono.
 *
 * Cores saem do kit do próprio app (`theme/dataColors.ts`), então tema claro,
 * escuro e marca continuam valendo. Cor segue a ENTIDADE (hash do nome), não a
 * posição no ranking: filtrar não repinta o resto.
 */

type Preset = '7' | '30' | '90' | 'mes';

const PRESETS: { id: Preset; label: string }[] = [
  { id: '7', label: '7 dias' },
  { id: '30', label: '30 dias' },
  { id: '90', label: '90 dias' },
  { id: 'mes', label: 'Este mês' },
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function janela(preset: Preset): { from: string; to: string; rotulo: string } {
  const hoje = new Date();
  if (preset === 'mes') {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { from: iso(inicio), to: iso(hoje), rotulo: 'este mês' };
  }
  const dias = Number(preset);
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - (dias - 1));
  return { from: iso(inicio), to: iso(hoje), rotulo: `últimos ${dias} dias` };
}

export function AiDadosPage() {
  const [preset, setPreset] = useState<Preset>('30');
  const { from, to, rotulo } = useMemo(() => janela(preset), [preset]);
  const query = useDashboard(from, to);
  const d = query.data;

  return (
    <div className="flex flex-col gap-5">
      {/* Filtro de período: uma linha, acima de tudo. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Leitura do salão</h1>
          <p className="text-xs text-muted-ink">
            {rotulo} · comparado com o período anterior de mesmo tamanho
          </p>
        </div>
        <div
          className="flex gap-1 rounded-xl bg-card p-1 shadow-[var(--shadow-card)]"
          role="group"
          aria-label="Período"
        >
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              aria-pressed={preset === p.id}
              className={[
                'min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors sm:text-sm',
                preset === p.id
                  ? 'bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] text-primary'
                  : 'text-muted-ink hover:text-ink',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <LoadingState label="Lendo os dados do salão…" />
      ) : query.isError || !d ? (
        <ErrorState
          message="Não foi possível carregar os dados do período."
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <Leituras d={d} />
          <Indicadores d={d} />
          <Tendencia d={d} />
          <div className="grid gap-5 lg:grid-cols-2">
            <Ocupacao d={d} />
            <Categorias d={d} />
          </div>
          <Horarios d={d} />
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── leituras (cálculo, não IA) */

interface Leitura {
  tom: 'boa' | 'atencao' | 'neutra';
  texto: string;
}

function montarLeituras(d: Dashboard): Leitura[] {
  const l: Leitura[] = [];
  // "caiu -27%" tem sinal duplicado; a direção já está na palavra.
  const pct = (v: number) => `${Math.abs(v).toFixed(0)}%`;

  if (Math.abs(d.vendasTotais.deltaPct) >= 5) {
    const caiu = d.vendasTotais.deltaPct < 0;
    l.push({
      tom: caiu ? 'atencao' : 'boa',
      texto: `Faturamento ${caiu ? 'caiu' : 'subiu'} ${pct(d.vendasTotais.deltaPct)} contra o período anterior (${formatMoney(d.vendasTotais.valor)}).`,
    });
  }
  if (Math.abs(d.ticketMedio.deltaPct) >= 5) {
    const caiu = d.ticketMedio.deltaPct < 0;
    l.push({
      tom: caiu ? 'atencao' : 'boa',
      texto: `Ticket médio ${caiu ? 'caiu' : 'subiu'} ${pct(d.ticketMedio.deltaPct)} e está em ${formatMoney(d.ticketMedio.valor)}.`,
    });
  }
  if (d.comandasCount.taxaConversao > 0 && d.comandasCount.taxaConversao < 70) {
    l.push({
      tom: 'atencao',
      texto: `Só ${d.comandasCount.taxaConversao.toFixed(0)}% dos agendamentos viraram comanda. O resto não foi faturado.`,
    });
  }
  const cheio = [...d.ocupacaoAgenda].sort((a, b) => b.pct - a.pct)[0];
  if (cheio && cheio.pct >= 80) {
    l.push({
      tom: 'atencao',
      texto: `${cheio.name} está com ${cheio.pct.toFixed(0)}% da agenda ocupada — quase sem espaço para encaixe.`,
    });
  }
  // `pct >= 1`: com 0,4% o texto saía "tem 0% de ocupação", que lido é erro.
  const vazio = [...d.ocupacaoAgenda]
    .filter((p) => p.pct >= 1)
    .sort((a, b) => a.pct - b.pct)[0];
  if (vazio && vazio.pct <= 30 && d.ocupacaoAgenda.length > 1) {
    l.push({
      tom: 'neutra',
      texto: `${vazio.name} tem ${vazio.pct.toFixed(0)}% de ocupação: sobra horário para remarcar cliente.`,
    });
  }
  const top = [...d.vendasPorCategoria].sort((a, b) => b.valor - a.valor)[0];
  if (top && top.pct >= 40) {
    l.push({
      tom: 'neutra',
      texto: `${top.categoria} concentra ${top.pct.toFixed(0)}% das vendas do período.`,
    });
  }
  // O funil liga comanda↔agendamento por `Order.appointmentId`. Histórico
  // importado não tem esse vínculo, então `faturados: 0` com 65 comandas no
  // período NÃO significa que ninguém faturou — significa que o vínculo não
  // existe. Afirmar "0 chegaram a faturar" ali seria mentira; a leitura só sai
  // quando o dado sustenta.
  const perdidos = d.funil.todos - d.funil.faturados;
  if (d.funil.todos > 0 && d.funil.faturados > 0 && perdidos > 0) {
    l.push({
      tom: perdidos / d.funil.todos > 0.3 ? 'atencao' : 'neutra',
      texto: `De ${formatNumber(d.funil.todos)} agendamentos, ${formatNumber(d.funil.faturados)} chegaram a faturar.`,
    });
  }
  return l.slice(0, 5);
}

function Leituras({ d }: { d: Dashboard }) {
  const leituras = useMemo(() => montarLeituras(d), [d]);
  if (leituras.length === 0) return null;

  const cor: Record<Leitura['tom'], string> = {
    boa: 'var(--sp-status-success)',
    atencao: 'var(--sp-status-warning)',
    neutra: 'var(--sp-status-neutral)',
  };

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-primary">
          <IconSparkles size={16} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">Leituras do período</h2>
          <p className="text-xs text-muted-ink">
            Calculado a partir dos números abaixo — não é texto gerado por
            modelo. O que a IA vai responder em conversa fica na próxima etapa.
          </p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-2.5">
        {leituras.map((leitura) => (
          <li key={leitura.texto} className="flex items-start gap-2.5 text-sm text-ink">
            <span
              aria-hidden
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ background: cor[leitura.tom] }}
            />
            <span>{leitura.texto}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─────────────────────────── indicadores (stat tiles) */

function Indicadores({ d }: { d: Dashboard }) {
  const itens = [
    { rotulo: 'Faturamento', valor: formatMoney(d.vendasTotais.valor), delta: d.vendasTotais.deltaPct },
    { rotulo: 'Ticket médio', valor: formatMoney(d.ticketMedio.valor), delta: d.ticketMedio.deltaPct },
    { rotulo: 'Agendamentos', valor: formatNumber(d.agendamentosCount.valor), delta: d.agendamentosCount.deltaPct },
    {
      // A taxa de conversão do painel compara comandas com agendamentos do
      // período — em salão com balcão/encaixe ela passa de 100% (Fátima: 65
      // comandas contra 41 agendamentos, "159%"). Mostrar isso como "viraram
      // comanda" é número errado na cara do dono, então o indicador é a
      // CONTAGEM e a taxa só aparece quando faz sentido.
      rotulo: 'Comandas',
      valor: formatNumber(d.comandasCount.valor),
      delta: null as number | null,
      apoio:
        d.comandasCount.taxaConversao > 0 && d.comandasCount.taxaConversao <= 100
          ? `${d.comandasCount.taxaConversao.toFixed(0)}% dos agendamentos`
          : d.comandasCount.taxaConversao > 100
            ? 'mais comandas que agendamentos (balcão/encaixe)'
            : 'sem comanda no período',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map((item) => (
        <div
          key={item.rotulo}
          className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]"
        >
          <p className="text-xs text-muted-ink">{item.rotulo}</p>
          <p className="mt-1 text-lg font-semibold text-ink sm:text-xl">{item.valor}</p>
          {item.delta === null || item.delta === undefined ? (
            <p className="mt-1 text-xs text-muted-ink">{item.apoio}</p>
          ) : Math.abs(item.delta) < 0.5 ? (
            // Seta verde para cima com "0%" é contradição na tela.
            <p className="mt-1 text-xs text-muted-ink">estável vs anterior</p>
          ) : (
            <p
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold"
              style={{
                color:
                  item.delta > 0
                    ? 'var(--sp-status-success)'
                    : 'var(--sp-status-danger)',
              }}
            >
              {item.delta > 0 ? <IconArrowUp size={12} /> : <IconArrowDown size={12} />}
              {`${Math.abs(item.delta).toFixed(0)}%`}
              <span className="font-normal text-muted-ink">vs anterior</span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── tendência (2 séries → legenda obrigatória) */

function Tendencia({ d }: { d: Dashboard }) {
  const c = useThemeColors();
  const dados = useMemo(
    () =>
      d.tendenciaVisitas.map((p) => ({
        dia: new Date(`${p.date}T12:00:00`).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }),
        Agendamentos: p.agendamentos,
        Comandas: p.comandas,
      })),
    [d.tendenciaVisitas],
  );

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-ink">Agendamentos × comandas por dia</h2>
      <p className="text-xs text-muted-ink">
        A distância entre as duas linhas é o que foi agendado e não faturado.
      </p>
      {dados.length === 0 ? (
        <EmptyState title="Sem movimento no período" />
      ) : (
        <div className="mt-4 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dados} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="ia-agend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.appointments} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={c.appointments} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ia-comandas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.orders} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={c.orders} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={c.chartGrid} />
              <XAxis
                dataKey="dia"
                tickLine={false}
                axisLine={{ stroke: c.chartGrid }}
                tick={{ fontSize: 11, fill: c.chartAxis }}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={{ stroke: c.chartGrid }}
                tick={{ fontSize: 11, fill: c.chartAxis }}
                width={34}
              />
              <Tooltip
                formatter={(v: number, nome) => [formatNumber(v), String(nome)]}
                labelFormatter={(l) => `Dia ${l}`}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="Agendamentos"
                stroke={c.appointments}
                strokeWidth={2}
                fill="url(#ia-agend)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="Comandas"
                stroke={c.orders}
                strokeWidth={2}
                fill="url(#ia-comandas)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────── ocupação por profissional */

function Ocupacao({ d }: { d: Dashboard }) {
  const dados = useMemo(
    () =>
      [...d.ocupacaoAgenda]
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 8)
        .map((p) => ({ nome: p.name, pct: Number(p.pct.toFixed(1)), id: p.professionalId })),
    [d.ocupacaoAgenda],
  );

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <IconUsers size={15} className="text-muted-ink" />
        Ocupação da agenda
      </h2>
      <p className="text-xs text-muted-ink">Quanto da agenda de cada pessoa está tomada.</p>
      {dados.length === 0 ? (
        <EmptyState title="Sem agenda no período" />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {dados.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm text-ink" title={p.nome}>
                {p.nome}
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.min(100, p.pct)}%`,
                    background: getCategoricalColor(p.id || p.nome),
                  }}
                />
              </span>
              <span className="w-12 shrink-0 text-right text-sm font-semibold text-ink">
                {p.pct.toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-ink">
        Acima de 80% costuma significar cliente sem horário; abaixo de 30%, espaço
        para remarcar. A barra é a % da grade disponível no período.
      </p>
    </section>
  );
}

/* ─────────────────────────── vendas por categoria */

function Categorias({ d }: { d: Dashboard }) {
  const c = useThemeColors();
  const dados = useMemo(
    () =>
      [...d.vendasPorCategoria]
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8)
        .map((v) => ({ nome: v.categoria, valor: v.valor })),
    [d.vendasPorCategoria],
  );

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-ink">Vendas por categoria</h2>
      <p className="text-xs text-muted-ink">De onde veio o faturamento do período.</p>
      {dados.length === 0 ? (
        <EmptyState title="Sem vendas no período" />
      ) : (
        <div className="mt-4 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dados}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={c.chartGrid} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={{ stroke: c.chartGrid }}
                tick={{ fontSize: 11, fill: c.chartAxis }}
                tickFormatter={(v: number) => formatMoney(v)}
              />
              <YAxis
                type="category"
                dataKey="nome"
                width={110}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: c.chartAxis }}
              />
              <Tooltip formatter={(v: number) => [formatMoney(v), 'Vendas']} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {dados.map((linha) => (
                  <Cell key={linha.nome} fill={getCategoricalColor(linha.nome)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────── horários mais cheios (heatmap) */

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function Horarios({ d }: { d: Dashboard }) {
  const { hours, weekdays, matrix, max } = d.mapaCalor;
  if (!hours?.length || !weekdays?.length || max <= 0) return null;

  return (
    // `min-w-0`: sem isso o item de flex cresce até o conteúdo (a tabela de
    // 520px) e empurra a PÁGINA no celular — o `overflow-x-auto` do filho não
    // resolve, porque o container já nasceu largo.
    <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <IconClock size={15} className="text-muted-ink" />
        Horários mais cheios
      </h2>
      <p className="text-xs text-muted-ink">
        Intensidade = quantidade de atendimentos naquele dia e hora.
      </p>
      <div className="mt-4 w-full max-w-full overflow-x-auto">
        <table className="min-w-[520px] border-separate border-spacing-[2px] text-[11px]">
          <thead>
            <tr>
              <th className="w-10" />
              {hours.map((h) => (
                <th key={h} className="font-normal text-muted-ink">
                  {String(h).padStart(2, '0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekdays.map((dia, linha) => (
              <tr key={dia}>
                <th className="pr-1 text-right font-normal text-muted-ink">
                  {DIAS[dia] ?? dia}
                </th>
                {hours.map((h, coluna) => {
                  const valor = matrix?.[linha]?.[coluna] ?? 0;
                  const intensidade = valor / max;
                  return (
                    <td
                      key={`${dia}-${h}`}
                      title={`${DIAS[dia] ?? dia} ${String(h).padStart(2, '0')}h — ${formatNumber(valor)} atendimento(s)`}
                      className="h-6 min-w-6 rounded-[4px]"
                      style={{
                        background:
                          valor === 0
                            ? 'var(--sp-canvas)'
                            : `color-mix(in oklab, var(--sp-data-appointments) ${Math.round(12 + intensidade * 88)}%, transparent)`,
                      }}
                    >
                      <span className="sr-only">{valor}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
