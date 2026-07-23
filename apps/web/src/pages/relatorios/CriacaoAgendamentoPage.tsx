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
  IconCalendarPlus,
  IconDownload,
  IconUsers,
} from '../../components/icons';
import { formatNumber, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useReportsCriacaoAgendamento } from '../../lib/queries/relatorios';
import { useThemeColors } from '../../theme/useThemeColors';
import { CalendarReportShell } from './reportNav';
import { shortDay } from './reportShared';

/* -------------------------------------------------------------------------- */
/*  Relatório real "Criação de Agendamento" (/reports/calendars/creation).    */
/*  Quando e por quem os agendamentos foram criados no período.               */
/*  Período + Gerar relatório → KPIs + criações por dia + tabela por autor.   */
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
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--sp-data-appointments-soft)] text-data-appointments">
          {icon}
        </span>
        <span className="text-sm font-medium text-ink">{title}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-ink sm:text-3xl">{value}</div>
      {hint && <p className="mt-1 text-sm text-muted-ink">{hint}</p>}
    </div>
  );
}

export function CriacaoAgendamentoPage() {
  const colors = useThemeColors();

  const [range, setRange] = useState(defaultRange);
  const [pending, setPending] = useState(range);

  const query = useReportsCriacaoAgendamento(range.from, range.to);
  const d = query.data;

  const byDay = d?.byDay ?? [];
  const byAuthor = d?.byAuthor ?? [];
  const total = d?.total ?? 0;
  const media = byDay.length > 0 ? total / byDay.length : 0;
  const hasData = !!d && (total > 0 || byDay.length > 0 || byAuthor.length > 0);

  function gerarRelatorio() {
    setRange(pending);
    void query.refetch();
  }

  function exportCsv() {
    downloadCsv(
      `criacao-agendamento-${range.from}_a_${range.to}`,
      [
        { header: 'Responsável', value: (r: (typeof byAuthor)[number]) => r.name },
        { header: 'Agendamentos criados', value: (r) => r.count },
        {
          header: 'Participação (%)',
          value: (r) => (total > 0 ? ((r.count / total) * 100).toFixed(1) : '0'),
        },
      ],
      byAuthor,
    );
  }

  return (
    <CalendarReportShell
      activeKey="creation"
      title="Criação de Agendamento"
      subtitle="Quando e por quem os agendamentos foram criados"
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
          <p className="text-sm font-medium text-ink">Não há dados</p>
          <p className="text-sm text-muted-ink">
            Nenhum agendamento criado no período selecionado.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi
              icon={<IconCalendarPlus size={18} />}
              title="Agendamentos criados"
              value={formatNumber(total)}
            />
            <Kpi
              icon={<IconCalendar size={18} />}
              title="Média por dia"
              value={media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
              hint={`${formatNumber(byDay.length)} dia(s) com criação`}
            />
            <Kpi
              icon={<IconUsers size={18} />}
              title="Responsáveis"
              value={formatNumber(byAuthor.length)}
            />
          </div>

          {/* Criações por dia */}
          <div className={`${CARD} mt-4 p-5`}>
            <h3 className="mb-3 text-sm font-semibold text-ink">Criações por dia</h3>
            {byDay.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-ink">
                Sem criações no período.
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
                      formatter={(v: number) => [formatNumber(v), 'Criados']}
                    />
                    <Bar dataKey="count" fill={colors.appointments} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Tabela por responsável */}
          <div className={`${CARD} mt-4 overflow-hidden`}>
            <div className="border-b border-line px-5 py-4">
              <h3 className="text-sm font-semibold text-ink">Criação por responsável</h3>
            </div>
            {byAuthor.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-ink">
                Nenhum responsável encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted-ink">
                      <th className="px-5 py-3">Responsável</th>
                      <th className="px-5 py-3 text-right">Criados</th>
                      <th className="px-5 py-3 text-right">Participação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byAuthor.map((a) => {
                      const share = total > 0 ? (a.count / total) * 100 : 0;
                      return (
                        <tr
                          key={a.userId ?? a.name}
                          className="border-b border-line/70 last:border-0 hover:bg-ink/5"
                        >
                          <td className="px-5 py-3 text-ink">{a.name}</td>
                          <td className="px-5 py-3 text-right font-medium text-ink">
                            {formatNumber(a.count)}
                          </td>
                          <td className="px-5 py-3 text-right text-muted-ink">
                            {share.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-ink/5 font-semibold text-ink">
                      <td className="px-5 py-3">Total</td>
                      <td className="px-5 py-3 text-right">{formatNumber(total)}</td>
                      <td className="px-5 py-3 text-right">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </CalendarReportShell>
  );
}
