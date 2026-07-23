import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DateRangePicker } from '../../components/DatePicker';
import {
  IconCalendar,
  IconDownload,
  IconTrash,
  IconTrendUp,
} from '../../components/icons';
import { formatDate, formatDateTime, formatNumber, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useReportsAgendamentosExcluidos } from '../../lib/queries/relatorios';
import { useThemeColors } from '../../theme/useThemeColors';
import { CalendarReportShell } from './reportNav';
import { shortDay } from './reportShared';

/* -------------------------------------------------------------------------- */
/*  Relatório real "Agendamentos excluídos" (/reports/calendars/deleted).     */
/*  Período + Gerar relatório → KPIs + gráfico por dia + tabela detalhada.     */
/*  Themeable (tokens --sp-*) e responsivo (web + mobile).                     */
/* -------------------------------------------------------------------------- */

const CARD = 'rounded-xl border border-line bg-card shadow-[var(--shadow-card)]';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: isoDate(from), to: isoDate(to) };
}

function Kpi({
  icon,
  title,
  value,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-danger-soft text-status-danger-fg">
          {icon}
        </span>
        <span className="text-sm font-medium text-ink">{title}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-ink sm:text-3xl">{value}</div>
      {hint && <p className="mt-1 text-sm text-muted-ink">{hint}</p>}
    </div>
  );
}

export function AgendamentosExcluidosPage() {
  const colors = useThemeColors();

  const [range, setRange] = useState(defaultRange);
  const [pending, setPending] = useState(range);

  const query = useReportsAgendamentosExcluidos(range.from, range.to);
  const d = query.data;

  const byDay = d?.byDay ?? [];
  const items = d?.items ?? [];
  const total = d?.totalDeleted ?? 0;
  const media = byDay.length > 0 ? total / byDay.length : 0;
  const pico = byDay.reduce((m, r) => (r.count > m ? r.count : m), 0);
  const hasData = !!d && (total > 0 || items.length > 0 || byDay.length > 0);

  function gerarRelatorio() {
    setRange(pending);
    void query.refetch();
  }

  function exportCsv() {
    downloadCsv(
      `agendamentos-excluidos-${range.from}_a_${range.to}`,
      [
        { header: 'Data agendada', value: (r: (typeof items)[number]) => formatDate(r.start) },
        { header: 'Cliente', value: (r) => r.customerName ?? '' },
        { header: 'Profissional', value: (r) => r.professionalName ?? '' },
        { header: 'Serviço', value: (r) => r.serviceName ?? '' },
        { header: 'Excluído em', value: (r) => (r.deletedAt ? formatDateTime(r.deletedAt) : '') },
        { header: 'Excluído por', value: (r) => r.deletedBy ?? '' },
        { header: 'Motivo', value: (r) => r.reason ?? '' },
      ],
      items,
    );
  }

  return (
    <CalendarReportShell
      activeKey="deleted"
      title="Agendamentos excluídos"
      subtitle="Agendamentos removidos no período"
    >
      {/* Filtro: Período + Gerar relatório */}
      <div className={`${CARD} p-4 sm:p-5`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            gerarRelatorio();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Período</label>
              <DateRangePicker
                from={pending.from}
                to={pending.to}
                onChange={setPending}
                ariaLabel="Período"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={query.isFetching}
              className="flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:flex-1"
            >
              {query.isFetching ? 'Gerando…' : 'Gerar relatório'}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!hasData}
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-card px-5 text-sm font-medium text-ink transition-colors hover:bg-primary/5 disabled:opacity-50"
            >
              <IconDownload size={16} /> Exportar CSV
            </button>
          </div>
        </form>
      </div>

      {/* Resultados */}
      {query.isLoading ? (
        <div className={`${CARD} mt-4 flex h-64 items-center justify-center text-sm text-muted-ink`}>
          Carregando…
        </div>
      ) : !hasData ? (
        <div className={`${CARD} mt-4 flex h-64 flex-col items-center justify-center gap-1 text-center`}>
          <p className="text-sm font-medium text-ink">Nenhum agendamento excluído</p>
          <p className="text-sm text-muted-ink">Não há exclusões no período selecionado.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi
              icon={<IconTrash size={18} />}
              title="Total excluídos"
              value={formatNumber(total)}
            />
            <Kpi
              icon={<IconCalendar size={18} />}
              title="Média por dia"
              value={media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
              hint={`${formatNumber(byDay.length)} dia(s) com exclusão`}
            />
            <Kpi
              icon={<IconTrendUp size={18} />}
              title="Pico em um dia"
              value={formatNumber(pico)}
            />
          </div>

          {/* Exclusões por dia */}
          <div className={`${CARD} mt-4 p-5`}>
            <h3 className="mb-3 text-sm font-semibold text-ink">Exclusões por dia</h3>
            {byDay.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-ink">
                Sem exclusões no período.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDay} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.chartGrid} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDay}
                      tick={{ fontSize: 11, fill: colors.chartAxis }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: colors.chartAxis }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <Tooltip
                      labelFormatter={(l: string) => shortDay(l)}
                      formatter={(v: number) => [formatNumber(v), 'Excluídos']}
                    />
                    <Bar dataKey="count" fill={colors.expense} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Tabela detalhada */}
          <div className={`${CARD} mt-4 overflow-hidden`}>
            <div className="border-b border-line px-5 py-4">
              <h3 className="text-sm font-semibold text-ink">Detalhamento</h3>
            </div>
            {items.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-ink">
                Nenhum item encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted-ink">
                      <th className="px-5 py-3">Data agendada</th>
                      <th className="px-5 py-3">Cliente</th>
                      <th className="px-5 py-3">Profissional</th>
                      <th className="px-5 py-3">Serviço</th>
                      <th className="px-5 py-3">Excluído em</th>
                      <th className="px-5 py-3">Por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr
                        key={it.id}
                        className="border-b border-line/70 last:border-0 hover:bg-ink/5"
                      >
                        <td className="px-5 py-3 text-ink">{formatDate(it.start)}</td>
                        <td className="px-5 py-3 text-ink">{it.customerName ?? '—'}</td>
                        <td className="px-5 py-3 text-muted-ink">{it.professionalName ?? '—'}</td>
                        <td className="px-5 py-3 text-muted-ink">{it.serviceName ?? '—'}</td>
                        <td className="px-5 py-3 text-muted-ink">
                          {it.deletedAt ? formatDateTime(it.deletedAt) : '—'}
                        </td>
                        <td className="px-5 py-3 text-muted-ink">{it.deletedBy ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </CalendarReportShell>
  );
}
