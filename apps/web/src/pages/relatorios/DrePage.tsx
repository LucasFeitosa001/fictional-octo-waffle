import { useState } from 'react';
import { Button, Card } from '@heroui/react';
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
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/States';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { IconArrowDown, IconArrowUp, IconDownload, IconWallet } from '../../components/icons';
import { formatMoney, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useReportsDre, type DreLinha } from '../../lib/queries/relatorios';
import { BackToReports, CARD, COLOR_GREEN, COLOR_RED } from './reportShared';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(1); // início do mês
  return { from: isoDate(from), to: isoDate(to) };
}

function LinhasTabela({
  titulo,
  linhas,
  total,
  tone,
}: {
  titulo: string;
  linhas: DreLinha[];
  total: number;
  tone: 'success' | 'danger';
}) {
  const toneText = tone === 'success' ? 'text-success' : 'text-danger';
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">{titulo}</h4>
        <span className={`text-sm font-bold ${toneText}`}>{formatMoney(total)}</span>
      </div>
      {linhas.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted">Sem lançamentos no período.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-soft-border)]">
          {linhas.map((l, i) => (
            <li key={`${l.categoria}-${i}`} className="flex items-center justify-between py-2">
              <span className="truncate text-sm text-foreground">{l.categoria}</span>
              <span className={`text-sm font-medium ${toneText}`}>{formatMoney(l.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DrePage() {
  const [range, setRange] = useState(defaultRange);
  const query = useReportsDre(range.from, range.to);
  const d = query.data;

  const chartData = d
    ? [
        { name: 'Receitas', valor: d.totalReceitas, tipo: 'receita' as const },
        { name: 'Despesas', valor: d.totalDespesas, tipo: 'despesa' as const },
        { name: 'Resultado', valor: d.resultado, tipo: 'resultado' as const },
      ]
    : [];
  const hasData =
    (d?.receitas.linhas.length ?? 0) > 0 || (d?.despesas.linhas.length ?? 0) > 0;

  const resultadoPositivo = (d?.resultado ?? 0) >= 0;

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
    <div>
      <BackToReports />
      <PageHeader
        title="DRE — Demonstrativo de Resultado"
        subtitle="Receitas e despesas liquidadas por categoria (regime de caixa)"
        actions={
          <Button variant="outline" onClick={exportCsv} isDisabled={!d}>
            <IconDownload size={16} /> Exportar CSV
          </Button>
        }
      />

      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </Card.Content>
      </Card>

      {query.isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* Totais */}
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className={CARD}>
              <Card.Content className="p-5">
                <div className="flex items-center gap-2 text-muted">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/12 text-success">
                    <IconArrowUp size={18} />
                  </span>
                  <span className="text-sm font-medium text-foreground">Total de receitas</span>
                </div>
                <div className="mt-3 text-2xl font-bold text-success sm:text-3xl">
                  {formatMoney(d?.totalReceitas ?? 0)}
                </div>
              </Card.Content>
            </Card>
            <Card className={CARD}>
              <Card.Content className="p-5">
                <div className="flex items-center gap-2 text-muted">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger/12 text-danger">
                    <IconArrowDown size={18} />
                  </span>
                  <span className="text-sm font-medium text-foreground">Total de despesas</span>
                </div>
                <div className="mt-3 text-2xl font-bold text-danger sm:text-3xl">
                  {formatMoney(d?.totalDespesas ?? 0)}
                </div>
              </Card.Content>
            </Card>
            <Card className={CARD}>
              <Card.Content className="p-5">
                <div className="flex items-center gap-2 text-muted">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
                    <IconWallet size={18} />
                  </span>
                  <span className="text-sm font-medium text-foreground">Resultado</span>
                </div>
                <div
                  className={`mt-3 text-2xl font-bold sm:text-3xl ${
                    resultadoPositivo ? 'text-success' : 'text-danger'
                  }`}
                >
                  {formatMoney(d?.resultado ?? 0)}
                </div>
              </Card.Content>
            </Card>
          </div>

          {/* Gráfico */}
          <Card className={`mb-4 ${CARD}`}>
            <Card.Content className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Receitas × Despesas × Resultado
              </h3>
              {!hasData ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted">
                  Sem lançamentos no período.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#888' }} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#888' }}
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
            </Card.Content>
          </Card>

          {/* Tabelas de detalhamento */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className={CARD}>
              <Card.Content className="p-5">
                {d ? (
                  <LinhasTabela
                    titulo="Receitas por categoria"
                    linhas={d.receitas.linhas}
                    total={d.receitas.total}
                    tone="success"
                  />
                ) : (
                  <EmptyState title="Sem dados" />
                )}
              </Card.Content>
            </Card>
            <Card className={CARD}>
              <Card.Content className="p-5">
                {d ? (
                  <LinhasTabela
                    titulo="Despesas por categoria"
                    linhas={d.despesas.linhas}
                    total={d.despesas.total}
                    tone="danger"
                  />
                ) : (
                  <EmptyState title="Sem dados" />
                )}
              </Card.Content>
            </Card>
          </div>

          {/* Receita de comandas (informativo) */}
          {d && d.comandas.ordersCount > 0 && (
            <Card className={`mt-4 ${CARD}`}>
              <Card.Content className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Receita de comandas no período
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[var(--color-soft-border)] bg-white px-4 py-3 shadow-[var(--shadow-soft)]">
                    <p className="text-xs text-muted">Total de comandas</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatMoney(d.comandas.receitaComandas)}
                    </p>
                    <p className="text-xs text-muted">{d.comandas.ordersCount} comandas</p>
                  </div>
                  <div className="rounded-xl border border-[var(--color-soft-border)] bg-white px-4 py-3 shadow-[var(--shadow-soft)]">
                    <p className="text-xs text-muted">Serviços</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatMoney(d.comandas.receitaServicos)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--color-soft-border)] bg-white px-4 py-3 shadow-[var(--shadow-soft)]">
                    <p className="text-xs text-muted">Produtos</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatMoney(d.comandas.receitaProdutos)}
                    </p>
                  </div>
                </div>
              </Card.Content>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
