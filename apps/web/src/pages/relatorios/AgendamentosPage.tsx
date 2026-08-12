import { useState } from 'react';
import { Checkbox } from '@heroui/react';
import { IconChevron } from '../../components/icons';
import { isoDate } from '../../lib/format';
import { useAgendaAppointments } from '../../lib/queries/agenda';
import { useProfessionals, useServices } from '../../lib/queries';
import { CalendarReportShell } from './reportNav';
import { requestReportPdf } from './ReportPdfButton';
import { DateRangePicker } from '../../components/DatePicker';

/* -------------------------------------------------------------------------- */
/*  Clone 100% fiel da página "Todos os Agendamentos" do Belasis              */
/*  (rota /reports/calendars/all). É um GERADOR de relatório: menu de tipos   */
/*  à esquerda + formulário de configuração à direita + "Gerar relatório".    */
/*  Cores 100% themeable via tokens (--sp-*). Mobile-first.                    */
/* -------------------------------------------------------------------------- */

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 1);
  return { from: isoDate(from), to: isoDate(to) };
}

// ---- Colunas selecionáveis do relatório (ordem idêntica ao Belasis) --------
const COLUMN_OPTIONS = [
  { value: 'employee', label: 'Profissional' },
  { value: 'date', label: 'Data' },
  { value: 'start_hour', label: 'Horário inicial' },
  { value: 'end_hour', label: 'Horário final' },
  { value: 'service', label: 'Serviço' },
  { value: 'client', label: 'Cliente' },
  { value: 'client_cellphone', label: 'Celular' },
  { value: 'address', label: 'Endereço' },
  { value: 'city_state', label: 'Cidade e Estado' },
  { value: 'obs', label: 'Observação' },
  { value: 'duration', label: 'Duração' },
  { value: 'status', label: 'Status' },
  { value: 'color', label: 'Cor' },
] as const;

// ---- Controle segmentado (ant-radio-group-solid) — themeable --------------
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-line">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              'px-4 py-1.5 text-sm font-medium transition-colors',
              i > 0 ? 'border-l border-line' : '',
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-ink hover:bg-canvas',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Rótulo de campo de formulário (ant-form-item-label) -------------------
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm text-ink" title={String(children)}>
      {children}
    </span>
  );
}

export function AgendamentosPage() {
  const [range, setRange] = useState(defaultRange);
  const [layout, setLayout] = useState<'portrait' | 'landscape'>('portrait');
  const [employeeStatus, setEmployeeStatus] = useState<'all' | 'actives' | 'inactives'>('all');
  const [specificProfessionalId, setSpecificProfessionalId] = useState('all');
  const [columnsOption, setColumnsOption] = useState<'columns' | 'empty_columns'>('columns');
  const [groupBy, setGroupBy] = useState('all');
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(COLUMN_OPTIONS.map((c) => c.value)),
  );

  const professionalsQuery = useProfessionals(1, 200, {
    status: employeeStatus === 'all' ? 'all' : employeeStatus === 'actives' ? 'active' : 'inactive',
  });
  const servicesQuery = useServices();
  const professionalRows = Array.isArray(professionalsQuery.data?.data) ? professionalsQuery.data.data : [];
  // `Todos/Ativos/Inativos` é o filtro de situação. Este segundo filtro permite
  // gerar somente os agendamentos de uma pessoa, sem alterar o cadastro nem a
  // agenda. O id também vai para a API, evitando buscar e filtrar uma lista
  // inteira no navegador.
  const professionalIds = specificProfessionalId !== 'all'
    ? [specificProfessionalId]
    : employeeStatus === 'all' ? undefined : professionalRows.map((p) => p.id);
  // A API usa `lte` no horário; somamos um dia para incluir todo o último dia
  // escolhido (até 23:59), sem alterar o período mostrado ao usuário.
  // Durante a seleção o DateRangePicker emite `{ from, to: '' }` entre o
  // primeiro e o segundo clique. Nunca tente converter esse estado parcial
  // para `toISOString()` — era isso que derrubava a rota ao trocar o período.
  const safeTo = range.to || range.from || isoDate(new Date());
  const endExclusive = new Date(`${safeTo}T00:00:00`);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const apiTo = isoDate(endExclusive);
  const appointmentsQuery = useAgendaAppointments({ from: range.from, to: apiTo, professionalIds }, { enabled: false });
  const serviceRows = Array.isArray(servicesQuery.data?.data) ? servicesQuery.data.data : [];
  const serviceNames = new Map(serviceRows.map((s) => [s.id, s.name]));
  const allowedProfessionalIds = professionalIds?.length ? new Set(professionalIds) : null;
  const appointmentRows = Array.isArray(appointmentsQuery.data?.data) ? appointmentsQuery.data.data : [];
  const reportAppointments = appointmentRows.filter((a) =>
    !allowedProfessionalIds || allowedProfessionalIds.has(a.professionalId ?? ''),
  );
  const serviceSummary = Array.from(reportAppointments.reduce((map, appointment) => {
    for (const item of appointment.items ?? []) {
      const name = serviceNames.get(item.serviceId) ?? item.serviceId;
      const current = map.get(name) ?? { name, count: 0, total: 0 };
      current.count += 1;
      current.total += Number(item.price) || 0;
      map.set(name, current);
    }
    return map;
  }, new Map<string, { name: string; count: number; total: number }>()).values());
  const totalServices = serviceSummary.reduce((sum, item) => sum + item.total, 0);
  const [generated, setGenerated] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  function toggleColumn(v: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  function gerarRelatorio() {
    // TODO: endpoint de geração de relatório de agendamentos (PDF) não existe
    // ainda no backend SalonPass — por ora reprocessa a query do período.
    appointmentsQuery.refetch();
    setGenerated(true);
  }

  function gerarPdf() {
    // O modal aparece primeiro. A busca e a montagem da tabela acontecem atrás
    // dele somente depois da confirmação da assinatura, sem piscar a página.
    requestReportPdf(async () => {
      await appointmentsQuery.refetch();
      setGenerated(true);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    });
  }

  return (
    <CalendarReportShell
      activeKey="all"
      title="Todos os Agendamentos"
      subtitle="Configure e gere o relatório de agendamentos do período"
    >
        {/* ---- Formulário de configuração do relatório ------------------- */}
        <form
          data-report-pdf-meta={`Período ${range.from} – ${range.to}; Layout ${layout === 'portrait' ? 'Retrato' : 'Paisagem'}; Profissionais ${specificProfessionalId === 'all' ? (employeeStatus === 'all' ? 'Todos' : employeeStatus === 'actives' ? 'Ativos' : 'Inativos') : professionalRows.find((p) => p.id === specificProfessionalId)?.name ?? 'Selecionado'}; Colunas ${columnsOption === 'columns' ? 'Informativa' : 'Em branco'}; Agrupar por ${groupBy === 'all' ? 'Todos' : groupBy === 'employee' ? 'Profissional' : 'Data'}; Campos ${COLUMN_OPTIONS.filter((c) => checked.has(c.value)).map((c) => c.label).join(', ')}`}
          data-report-pdf-layout={layout}
          className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            gerarRelatorio();
          }}
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            {/* Layout */}
            <div>
              <FieldLabel>Layout</FieldLabel>
              <Segmented
                value={layout}
                onChange={setLayout}
                options={[
                  { value: 'portrait', label: 'Retrato' },
                  { value: 'landscape', label: 'Paisagem' },
                ]}
              />
            </div>

            {/* Período */}
            <div>
              <FieldLabel>Período</FieldLabel>
              <DateRangePicker
                from={range.from}
                to={range.to}
                onChange={setRange}
                ariaLabel="Período"
              />
            </div>

            {/* Profissionais */}
            <div>
              <FieldLabel>Profissionais</FieldLabel>
              <Segmented
                value={employeeStatus}
                onChange={setEmployeeStatus}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'actives', label: 'Ativos' },
                  { value: 'inactives', label: 'Inativos' },
                ]}
              />
              <label className="mt-3 block text-sm text-ink">
                Profissional específico
                <select
                  value={specificProfessionalId}
                  onChange={(e) => setSpecificProfessionalId(e.target.value)}
                  aria-label="Profissional específico"
                  className="mt-1.5 h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="all">Todos os profissionais</option>
                  {professionalRows.map((professional) => (
                    <option key={professional.id} value={professional.id}>{professional.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Colunas */}
            <div>
              <FieldLabel>Colunas</FieldLabel>
              <Segmented
                value={columnsOption}
                onChange={setColumnsOption}
                options={[
                  { value: 'columns', label: 'Informativa' },
                  { value: 'empty_columns', label: 'Em Branco' },
                ]}
              />
            </div>

            {/* Agrupar por */}
            <div>
              <FieldLabel>Agrupar por</FieldLabel>
              <div className="relative">
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  aria-label="Agrupar por"
                  className="h-11 w-full appearance-none rounded-xl border border-line bg-card px-3 pr-9 text-sm text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30"
                >
                  <option value="all">Todos</option>
                  <option value="employee">Profissional</option>
                  <option value="date">Data</option>
                </select>
                <IconChevron
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-ink"
                />
              </div>
            </div>
          </div>

          {/* Checklist de colunas do relatório */}
          <div className="mt-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 md:grid-cols-3">
              {COLUMN_OPTIONS.map((c) => (
                <Checkbox
                  key={c.value}
                  isSelected={checked.has(c.value)}
                  onChange={() => toggleColumn(c.value)}
                  className="w-full cursor-pointer items-center gap-2 text-sm text-ink"
                >
                  <Checkbox.Content className="min-w-0 items-center gap-2">
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="min-w-0 truncate">{c.label}</span>
                  </Checkbox.Content>
                </Checkbox>
              ))}
            </div>
          </div>

          {/* Ação: Gerar relatório (botão primário) */}
          <div className="relative mt-6 flex justify-end">
            <button
              type="submit"
              disabled={appointmentsQuery.isFetching}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-l-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {appointmentsQuery.isFetching ? 'Gerando…' : 'Gerar relatório'}
              <IconChevron size={16} className="rotate-180" />
            </button>
            <button type="button" aria-label="Opções de geração" onClick={() => setExportOpen((v) => !v)} className="h-10 w-10 rounded-r-lg border-l border-white/25 bg-primary text-primary-foreground">···</button>
            {exportOpen && (
              <div className="report-no-print absolute right-0 top-12 z-20 w-52 rounded-xl border border-line bg-card p-1.5 shadow-[var(--shadow-pop)]">
                <button type="button" onClick={() => { setExportOpen(false); gerarPdf(); }} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-canvas">Gerar PDF</button>
              </div>
            )}
          </div>
        </form>
        {generated && (
          <>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
            <div className="border-b border-line px-4 py-3">
              <div className="text-sm font-semibold text-ink">Resumo por serviço</div>
              <div className="mt-1 text-xs text-muted-ink">Valores dos serviços registrados nos agendamentos do período</div>
            </div>
            {serviceSummary.length === 0 ? (
              <div className="p-4 text-sm text-muted-ink">Nenhum serviço encontrado no período.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted-ink"><th className="px-3 py-2">Serviço</th><th className="px-3 py-2">Quantidade</th><th className="px-3 py-2">Total</th></tr></thead>
                <tbody>{serviceSummary.map((item) => <tr key={item.name} className="border-b border-line last:border-0"><td className="px-3 py-2 text-ink">{item.name}</td><td className="px-3 py-2 text-ink">{item.count}</td><td className="px-3 py-2 font-medium text-ink">{item.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>)}</tbody>
                <tfoot><tr className="border-t-2 border-line font-semibold"><td className="px-3 py-2 text-ink">Total geral</td><td className="px-3 py-2 text-ink">{serviceSummary.reduce((sum, item) => sum + item.count, 0)}</td><td className="px-3 py-2 text-ink">{totalServices.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr></tfoot>
              </table>
            )}
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
              <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              Agendamentos de {range.from} a {range.to} ({reportAppointments.length})
            </div>
            {appointmentsQuery.isFetching ? (
              <div className="p-6 text-sm text-muted-ink">Carregando agendamentos…</div>
            ) : reportAppointments.length === 0 ? (
              <div className="p-6 text-sm text-muted-ink">Nenhum agendamento no período.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted-ink">
                  {COLUMN_OPTIONS.filter((c) => checked.has(c.value)).map((c) => <th key={c.value} className="whitespace-nowrap px-3 py-2">{c.label}</th>)}
                </tr></thead>
                <tbody>{reportAppointments.map((a) => <tr key={a.id} className="border-b border-line last:border-0">
                  {COLUMN_OPTIONS.filter((c) => checked.has(c.value)).map((c) => {
                    const start = new Date(a.start); const end = new Date(a.end);
                    const value: Record<string, string> = {
                      employee: a.professional?.name ?? '—', date: start.toLocaleDateString('pt-BR'),
                      start_hour: start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                      end_hour: end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                      service: a.items?.map((i) => serviceNames.get(i.serviceId) ?? i.serviceId).join(', ') || '—', client: a.customer?.name ?? '—',
                      client_cellphone: a.customer?.phone ?? '—', address: '—', city_state: '—', obs: a.notes ?? '—',
                      duration: `${Math.round((end.getTime() - start.getTime()) / 60000)} min`, status: a.status, color: '—',
                    };
                    return <td key={c.value} className="whitespace-nowrap px-3 py-2 text-ink">{value[c.value]}</td>;
                  })}
                </tr>)}</tbody>
              </table>
            )}
          </div>
          </>
        )}
    </CalendarReportShell>
  );
}
