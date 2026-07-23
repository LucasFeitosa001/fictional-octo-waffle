import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  IconCalendar,
  IconDownload,
  IconLink,
  IconReceipt,
} from '../../components/icons';
import { formatNumber, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useReportsOrigemAgendamentos } from '../../lib/queries/relatorios';
import { DateRangePicker } from '../../components/DatePicker';
import { getCategoricalColor } from '../../theme/dataColors';
import { CalendarReportShell } from './reportNav';

/* -------------------------------------------------------------------------- */
/*  Relatório real "Origem dos Agendamentos" (/reports/calendars/origin).     */
/*  De onde vieram os agendamentos (online, balcão, etc.) no período.         */
/*  Período + Gerar relatório → KPIs + pizza por origem + tabela.             */
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

export function OrigemAgendamentosPage() {
  const [range, setRange] = useState(defaultRange);
  const [pending, setPending] = useState(range);

  const query = useReportsOrigemAgendamentos(range.from, range.to);
  const d = query.data;

  const byOrigin = d?.byOrigin ?? [];
  const total = d?.total ?? 0;
  const online = byOrigin.find((o) => o.source === 'online')?.count ?? 0;
  const balcao = byOrigin.find((o) => o.source === 'admin')?.count ?? 0;
  const onlineShare = total > 0 ? (online / total) * 100 : 0;
  const hasData = !!d && (total > 0 || byOrigin.length > 0);

  function gerarRelatorio() {
    setRange(pending);
    void query.refetch();
  }

  function exportCsv() {
    downloadCsv(
      `origem-agendamentos-${range.from}_a_${range.to}`,
      [
        { header: 'Origem', value: (r: (typeof byOrigin)[number]) => r.label },
        { header: 'Quantidade', value: (r) => r.count },
        {
          header: 'Participação (%)',
          value: (r) => (total > 0 ? ((r.count / total) * 100).toFixed(1) : '0'),
        },
      ],
      byOrigin,
    );
  }

  return (
    <CalendarReportShell
      activeKey="origin"
      title="Origem dos Agendamentos"
      subtitle="De onde vieram os agendamentos (online, balcão, etc.)"
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
            Nenhum agendamento encontrado para o período selecionado.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi
              icon={<IconCalendar size={18} />}
              title="Total de agendamentos"
              value={formatNumber(total)}
            />
            <Kpi
              icon={<IconLink size={18} />}
              title="Online"
              value={formatNumber(online)}
              hint={`${onlineShare.toFixed(1)}% do total`}
            />
            <Kpi
              icon={<IconReceipt size={18} />}
              title="Balcão"
              value={formatNumber(balcao)}
              hint={`${(100 - onlineShare).toFixed(1)}% do total`}
            />
          </div>

          {/* Distribuição por origem */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={`${CARD} p-5`}>
              <h3 className="mb-3 text-sm font-semibold text-ink">Distribuição por origem</h3>
              {byOrigin.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-ink">
                  Sem dados de origem.
                </div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byOrigin}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                      >
                        {byOrigin.map((origin) => (
                          <Cell key={origin.source} fill={getCategoricalColor(origin.source)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [formatNumber(v), 'Agendamentos']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Tabela por origem */}
            <div className={`${CARD} overflow-hidden`}>
              <div className="border-b border-line px-5 py-4">
                <h3 className="text-sm font-semibold text-ink">Origens</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted-ink">
                      <th className="px-5 py-3">Origem</th>
                      <th className="px-5 py-3 text-right">Qtde</th>
                      <th className="px-5 py-3 text-right">Participação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byOrigin.map((o) => {
                      const share = total > 0 ? (o.count / total) * 100 : 0;
                      return (
                        <tr
                          key={o.source}
                          className="border-b border-line/70 last:border-0 hover:bg-ink/5"
                        >
                          <td className="px-5 py-3 text-ink">
                            <span className="flex items-center gap-2.5">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ background: getCategoricalColor(o.source) }}
                              />
                              {o.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-ink">
                            {formatNumber(o.count)}
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
            </div>
          </div>
        </>
      )}
    </CalendarReportShell>
  );
}
