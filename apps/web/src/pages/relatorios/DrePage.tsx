import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LoadingState } from '../../components/States';
import { Drawer } from '../../components/Drawer';
import {
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconChevron,
  IconDownload,
  IconInfo,
  IconWallet,
} from '../../components/icons';
import { formatMoney, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useReportsDre, type DreLinha } from '../../lib/queries/relatorios';
import { useThemeColors } from '../../theme/useThemeColors';
import { COLOR_GREEN, COLOR_RED } from './reportShared';
import { FinancialReportShell } from './reportNav';

/* -------------------------------------------------------------------------- */
/*  Clone 100% fiel da página "Resultados Financeiros" (DRE) do Belasis        */
/*  (rota /reports/financial/dre). É um GERADOR de relatório: submenu de       */
/*  relatórios financeiros à esquerda + formulário de configuração à direita   */
/*  + "Gerar relatório". Depois de gerar, mostra os KPIs, o gráfico e as       */
/*  tabelas de receitas/despesas por categoria. Clique numa linha abre o       */
/*  DRAWER lateral (deslizando da direita) com o detalhe da categoria.         */
/*  Cores 100% themeable via tokens (--sp-*). Mobile-first.                    */
/* -------------------------------------------------------------------------- */

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1); // início do mês
  return { from: isoDate(from), to: isoDate(to) };
}

// ---- "Planos de conta" (checkbox group, ordem idêntica ao Belasis) ---------
const PLAN_OPTIONS = [
  'Água/Luz',
  'Aluguel',
  'Comissão',
  'Compra de Equipamentos',
  'Despesas',
  'Despesas Pessoais',
  'Impostos',
  'Materiais de Consumo',
  'Pacotes',
  'Pro Labore',
  'Produtos',
  'Receitas',
  'Salário',
  'Serviços',
  'Telefone/Internet',
  'Transferência',
  'Vales',
];

// ---- Rótulo de campo (ant-form-item-label) ---------------------------------
function FieldLabel({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <span className="mb-1.5 flex items-center gap-1 text-sm text-ink" title={String(children)}>
      {children}
      {tooltip && <IconInfo size={13} className="text-muted-ink" aria-label={tooltip} />}
    </span>
  );
}

// ---- Switch "ant-switch" (Sim / Ambas) — themeable -------------------------
function Switch({
  checked,
  onChange,
  onLabel,
  offLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-7 min-w-[68px] items-center rounded-full px-2 text-xs font-medium transition-colors',
        checked ? 'justify-start bg-primary text-primary-foreground' : 'justify-end bg-muted-ink/40 text-white',
      ].join(' ')}
    >
      <span className={checked ? 'pr-6' : 'pl-6'}>{checked ? onLabel : offLabel}</span>
      <span
        className={[
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
          checked ? 'right-1' : 'left-1',
        ].join(' ')}
      />
    </button>
  );
}

// ---- Linha de categoria (clicável → abre o drawer de detalhe) --------------
function CategoriaLinha({
  linha,
  tone,
  onOpen,
}: {
  linha: DreLinha;
  tone: 'success' | 'danger';
  onOpen: (l: DreLinha) => void;
}) {
  const toneText = tone === 'success' ? 'text-success' : 'text-danger';
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(linha)}
        className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-canvas"
      >
        <span className="min-w-0 truncate text-sm text-ink">{linha.categoria}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className={`text-sm font-medium ${toneText}`}>{formatMoney(linha.valor)}</span>
          <IconChevron size={14} className="-rotate-90 text-muted-ink" />
        </span>
      </button>
    </li>
  );
}

function LinhasTabela({
  titulo,
  linhas,
  total,
  tone,
  onOpen,
}: {
  titulo: string;
  linhas: DreLinha[];
  total: number;
  tone: 'success' | 'danger';
  onOpen: (l: DreLinha) => void;
}) {
  const toneText = tone === 'success' ? 'text-success' : 'text-danger';
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-ink">{titulo}</h4>
        <span className={`text-sm font-bold ${toneText}`}>{formatMoney(total)}</span>
      </div>
      {linhas.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-ink">Sem lançamentos no período.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-line)]">
          {linhas.map((l, i) => (
            <CategoriaLinha key={`${l.categoria}-${i}`} linha={l} tone={tone} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function DrePage() {
  const colors = useThemeColors();
  const [range, setRange] = useState(defaultRange);

  // ---- Estado do formulário (campos do Belasis) ----------------------------
  const [discountConsumed, setDiscountConsumed] = useState<'ignore' | 'commission'>('ignore');
  const [account, setAccount] = useState('all');
  const [onlyActive, setOnlyActive] = useState(true);
  const [plans, setPlans] = useState<Set<string>>(
    () => new Set(PLAN_OPTIONS.filter((p) => p !== 'Vales')),
  );
  const [generated, setGenerated] = useState(false);
  const [detail, setDetail] = useState<DreLinha | null>(null);

  // ---- Data-wiring preservado ----------------------------------------------
  const query = useReportsDre(range.from, range.to);
  const d = query.data;

  const chartData = d
    ? [
        { name: 'Receitas', valor: d.totalReceitas, tipo: 'receita' as const },
        { name: 'Despesas', valor: d.totalDespesas, tipo: 'despesa' as const },
        { name: 'Resultado', valor: d.resultado, tipo: 'resultado' as const },
      ]
    : [];
  const hasData = (d?.receitas.linhas.length ?? 0) > 0 || (d?.despesas.linhas.length ?? 0) > 0;
  const resultadoPositivo = (d?.resultado ?? 0) >= 0;

  function togglePlan(p: string) {
    setPlans((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function gerarRelatorio() {
    setGenerated(true);
    query.refetch();
  }

  function exportCsv() {
    if (!d) return;
    downloadCsv(
      `dre-${range.from}_a_${range.to}`,
      [
        { header: 'Tipo', value: (r: DreLinha) => (r.tipo === 'receita' ? 'Receita' : 'Despesa') },
        { header: 'Categoria', value: (r) => r.categoria },
        { header: 'Valor', value: (r) => String(r.valor) },
      ],
      d.linhas,
    );
  }

  function barColor(tipo: string) {
    if (tipo === 'receita') return COLOR_GREEN;
    if (tipo === 'despesa') return COLOR_RED;
    return resultadoPositivo ? COLOR_GREEN : COLOR_RED;
  }

  return (
    <>
      <FinancialReportShell
        activeKey="dre"
        title="Resultados Financeiros"
        subtitle="Configure e gere o demonstrativo de resultado (DRE) do período"
        actions={
          <button
            type="button"
            onClick={exportCsv}
            disabled={!d}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
          >
            <IconDownload size={16} /> Exportar CSV
          </button>
        }
      >
        {/* ---- Conteúdo: formulário + resultados ------------------------- */}
        <div className="min-w-0 flex-1">
          {/* Formulário de configuração */}
          <form
            className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              gerarRelatorio();
            }}
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
              {/* Descontar o valor do produto consumido */}
              <div>
                <FieldLabel>Descontar o valor do produto consumido</FieldLabel>
                <div className="relative">
                  <select
                    value={discountConsumed}
                    onChange={(e) => setDiscountConsumed(e.target.value as 'ignore' | 'commission')}
                    aria-label="Descontar o valor do produto consumido"
                    className="h-11 w-full appearance-none rounded-xl border border-line bg-card px-3 pr-9 text-sm text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30"
                  >
                    <option value="ignore">Ignorar</option>
                    <option value="commission">Descontar da comissão</option>
                  </select>
                  <IconChevron
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-ink"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-ink">Descontar da comissão</p>
              </div>

              {/* Período */}
              <div>
                <FieldLabel>Período</FieldLabel>
                <div className="flex h-11 w-full items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm text-ink focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30">
                  <input
                    type="date"
                    value={range.from}
                    max={range.to || undefined}
                    onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                    aria-label="Data inicial"
                    className="min-w-0 flex-1 bg-transparent outline-none [color-scheme:light]"
                  />
                  <IconChevron size={14} className="shrink-0 -rotate-90 text-muted-ink" />
                  <input
                    type="date"
                    value={range.to}
                    min={range.from || undefined}
                    onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                    aria-label="Data final"
                    className="min-w-0 flex-1 bg-transparent outline-none [color-scheme:light]"
                  />
                  <IconCalendar size={16} className="shrink-0 text-muted-ink" />
                </div>
              </div>

              {/* Conta */}
              <div>
                <FieldLabel>Conta</FieldLabel>
                <div className="relative">
                  <select
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    aria-label="Conta"
                    className="h-11 w-full appearance-none rounded-xl border border-line bg-card px-3 pr-9 text-sm text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30"
                  >
                    <option value="all">Todas</option>
                    {/* TODO: listar contas reais quando o endpoint expuser contas do caixa */}
                  </select>
                  <IconChevron
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-ink"
                  />
                </div>
              </div>

              {/* Somente contas ativas? */}
              <div>
                <FieldLabel>Somente contas ativas?</FieldLabel>
                <Switch
                  checked={onlyActive}
                  onChange={setOnlyActive}
                  onLabel="Sim"
                  offLabel="Ambas"
                />
              </div>
            </div>

            {/* Planos de conta */}
            <div className="mt-5">
              <FieldLabel tooltip="Selecione os planos de conta que entram no relatório">
                Planos de conta
              </FieldLabel>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 md:grid-cols-3">
                {PLAN_OPTIONS.map((p, i) => (
                  <label
                    key={`${p}-${i}`}
                    className="flex cursor-pointer items-center gap-2 text-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={plans.has(p)}
                      onChange={() => togglePlan(p)}
                      className="h-4 w-4 shrink-0 rounded border-line accent-[var(--sp-primary)]"
                    />
                    <span className="min-w-0 truncate">{p}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Ação: Gerar relatório (botão primário + split de export) */}
            <div className="mt-6 flex justify-end gap-1.5">
              <button
                type="submit"
                disabled={query.isFetching}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {query.isFetching ? 'Gerando…' : 'Gerar relatório'}
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={!d}
                aria-label="Exportar"
                title="Exportar CSV"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <IconDownload size={16} />
              </button>
            </div>
          </form>

          {/* ---- Resultados do relatório -------------------------------- */}
          {generated && (
            <div className="mt-4">
              {query.isLoading ? (
                <LoadingState />
              ) : (
                <>
                  {/* KPIs */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/12 text-success">
                          <IconArrowUp size={18} />
                        </span>
                        <span className="text-sm font-medium text-ink">Total de receitas</span>
                      </div>
                      <div className="mt-3 text-2xl font-bold text-success sm:text-3xl">
                        {formatMoney(d?.totalReceitas ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger/12 text-danger">
                          <IconArrowDown size={18} />
                        </span>
                        <span className="text-sm font-medium text-ink">Total de despesas</span>
                      </div>
                      <div className="mt-3 text-2xl font-bold text-danger sm:text-3xl">
                        {formatMoney(d?.totalDespesas ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold-strong">
                          <IconWallet size={18} />
                        </span>
                        <span className="text-sm font-medium text-ink">Resultado</span>
                      </div>
                      <div
                        className={`mt-3 text-2xl font-bold sm:text-3xl ${
                          resultadoPositivo ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {formatMoney(d?.resultado ?? 0)}
                      </div>
                    </div>
                  </div>

                  {/* Gráfico */}
                  <div className="mt-4 rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
                    <h3 className="mb-3 text-sm font-semibold text-ink">
                      Receitas × Despesas × Resultado
                    </h3>
                    {!hasData ? (
                      <div className="flex h-64 items-center justify-center text-sm text-muted-ink">
                        Sem lançamentos no período.
                      </div>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.chartGrid} />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 12, fill: colors.chartAxis }}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: colors.chartAxis }}
                              tickLine={false}
                              axisLine={false}
                              width={64}
                              tickFormatter={(v: number) => formatMoney(v)}
                            />
                            <Tooltip formatter={(v: number) => formatMoney(v)} />
                            <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={72}>
                              {chartData.map((row) => (
                                <Cell key={row.name} fill={barColor(row.tipo)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Tabelas de detalhamento */}
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
                      <LinhasTabela
                        titulo="Receitas por categoria"
                        linhas={d?.receitas.linhas ?? []}
                        total={d?.receitas.total ?? 0}
                        tone="success"
                        onOpen={setDetail}
                      />
                    </div>
                    <div className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
                      <LinhasTabela
                        titulo="Despesas por categoria"
                        linhas={d?.despesas.linhas ?? []}
                        total={d?.despesas.total ?? 0}
                        tone="danger"
                        onOpen={setDetail}
                      />
                    </div>
                  </div>

                  {/* Receita de comandas (informativo) */}
                  {d && d.comandas.ordersCount > 0 && (
                    <div className="mt-4 rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
                      <h3 className="mb-3 text-sm font-semibold text-ink">
                        Receita de comandas no período
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-line bg-canvas px-4 py-3">
                          <p className="text-xs text-muted-ink">Total de comandas</p>
                          <p className="text-lg font-semibold text-ink">
                            {formatMoney(d.comandas.receitaComandas)}
                          </p>
                          <p className="text-xs text-muted-ink">{d.comandas.ordersCount} comandas</p>
                        </div>
                        <div className="rounded-xl border border-line bg-canvas px-4 py-3">
                          <p className="text-xs text-muted-ink">Serviços</p>
                          <p className="text-lg font-semibold text-ink">
                            {formatMoney(d.comandas.receitaServicos)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-line bg-canvas px-4 py-3">
                          <p className="text-xs text-muted-ink">Produtos</p>
                          <p className="text-lg font-semibold text-ink">
                            {formatMoney(d.comandas.receitaProdutos)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </FinancialReportShell>

      {/* ---- Drawer lateral: detalhe da categoria (desliza da direita) ---- */}
      <Drawer
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.categoria ?? 'Detalhe da categoria'}
      >
        {detail && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-xl border border-line bg-canvas px-4 py-3">
              <span className="text-sm text-muted-ink">Tipo</span>
              <span
                className={[
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  detail.tipo === 'receita'
                    ? 'bg-success/12 text-success'
                    : 'bg-danger/12 text-danger',
                ].join(' ')}
              >
                {detail.tipo === 'receita' ? 'Receita' : 'Despesa'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-line bg-canvas px-4 py-3">
              <span className="text-sm text-muted-ink">Categoria</span>
              <span className="text-sm font-medium text-ink">{detail.categoria}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-line bg-canvas px-4 py-3">
              <span className="text-sm text-muted-ink">Valor</span>
              <span
                className={`text-base font-bold ${
                  detail.tipo === 'receita' ? 'text-success' : 'text-danger'
                }`}
              >
                {formatMoney(detail.valor)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-line bg-canvas px-4 py-3">
              <span className="text-sm text-muted-ink">Período</span>
              <span className="text-sm font-medium text-ink">
                {range.from} — {range.to}
              </span>
            </div>
            {/* TODO: quando o endpoint expuser lançamentos por categoria, listar aqui
                as movimentações individuais que compõem este total. */}
            <p className="text-xs text-muted-ink">
              Total consolidado dos lançamentos liquidados desta categoria no período (regime de
              caixa).
            </p>
          </div>
        )}
      </Drawer>
    </>
  );
}
