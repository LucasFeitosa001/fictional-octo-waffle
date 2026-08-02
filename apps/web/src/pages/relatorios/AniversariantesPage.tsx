import { useState } from 'react';
import { Button, Card } from '@heroui/react';
import { EmptyState, LoadingState } from '../../components/States';
import { DataTable, type Column } from '../../components/DataTable';
import { IconDownload, IconGift, IconPhone } from '../../components/icons';
import { formatNumber, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useReportsBirthdays, type BirthdayItem } from '../../lib/queries/relatorios';
import { BackToReports, CARD } from './reportShared';
import { ReportCategoriesBar } from './reportNav';
import { DateRangePicker } from '../../components/DatePicker';
import { ReportPdfOption } from './ReportPdfButton';

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** Status do cliente, espelhando o radio-group do Belasis (Todos/Ativos/Inativos). */
type Status = 'all' | 'actives' | 'inactives';
const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'actives', label: 'Ativos' },
  { value: 'inactives', label: 'Inativos' },
];

/** Período inicial: primeiro → último dia do mês corrente. */
function defaultRange() {
  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 1);
  const to = now;
  return { from: isoDate(from), to: isoDate(to) };
}

export function AniversariantesPage() {
  const [status, setStatus] = useState<Status>('all');
  const [range, setRange] = useState(defaultRange);
  // O relatório só aparece depois de "Gerar relatório" (fluxo form-first do Belasis).
  const [generatedMonth, setGeneratedMonth] = useState<number | null>(null);

  // TODO: a API atual filtra por mês (não por range nem status); derivamos o mês
  // do início do período e mantemos status/fim como visuais até o backend suportar.
  const month = generatedMonth ?? new Date().getMonth() + 1;
  const query = useReportsBirthdays(month);
  const d = query.data;
  const customers = generatedMonth != null ? (d?.customers ?? []) : [];

  function gerar() {
    const m = Number(range.from.slice(5, 7)) || new Date().getMonth() + 1;
    setGeneratedMonth(m);
  }

  function exportCsv() {
    downloadCsv(
      `aniversariantes-${MONTHS[month - 1].toLowerCase()}`,
      [
        { header: 'Cliente', value: (r: BirthdayItem) => r.name },
        { header: 'Dia', value: (r) => (r.day != null ? String(r.day) : '') },
        { header: 'Telefone', value: (r) => r.phone ?? '' },
      ],
      customers,
    );
  }

  const columns: Column<BirthdayItem>[] = [
    {
      key: 'name',
      header: 'Cliente',
      isRowHeader: true,
      render: (r) => <span className="font-medium text-foreground">{r.name}</span>,
    },
    {
      key: 'day',
      header: 'Dia do aniversário',
      render: (r) => (
        <span className="inline-flex items-center rounded-md bg-[var(--sp-data-customers-soft)] px-2 py-0.5 text-xs font-semibold text-data-customers">
          dia {r.day ?? '—'}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (r) =>
        r.phone ? (
          <span className="inline-flex items-center gap-1.5 text-muted">
            <IconPhone size={14} />
            {r.phone}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];

  return (
    <div>
      <BackToReports />
      {/* Barra de categorias do módulo — esta página não tinha, então dela
          não dava para pular para outro relatório. Ver estudo 63. */}
      <ReportCategoriesBar ativa="Clientes" />

      {/* ── Formulário de relatório (fiel ao Belasis) ─────────────────────── */}
      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-5">
          <div className="mb-5 flex items-center gap-2">
            <IconGift size={22} className="text-gold-strong" />
            <h1 className="text-lg font-bold text-foreground">Aniversariantes</h1>
          </div>

          <div className="flex flex-col gap-4">
            {/* Status — segmented radio (solid, block) do Belasis */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Status</label>
              <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-line">
                {STATUS_OPTIONS.map((opt, i) => {
                  const active = opt.value === status;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className={[
                        'h-11 text-sm font-medium transition-colors',
                        i > 0 ? 'border-l border-line' : '',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-warm-white text-ink hover:bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Período — range box (De → Até) idêntico ao Belasis */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Período</label>
              <DateRangePicker
                from={range.from}
                to={range.to}
                onChange={setRange}
                ariaLabel="Período"
              />
            </div>

            {/* Gerar relatório — botão primário block */}
            <ReportPdfOption />
            <button
              type="button"
              onClick={gerar}
              className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-primary-strong"
            >
              Gerar relatório
            </button>
          </div>
        </Card.Content>
      </Card>

      {/* ── Resultado ─────────────────────────────────────────────────────── */}
      {generatedMonth == null ? (
        <Card className={`${CARD} !border-0 !bg-transparent !shadow-none md:!border md:!border-[var(--color-soft-border)] md:!bg-warm-white md:!shadow-[var(--shadow-card)]`}>
          <Card.Content className="p-0 md:p-8">
            <EmptyState
              title="Gere o relatório de aniversariantes"
              description="Selecione o status e o período acima e toque em “Gerar relatório”."
              icon={<IconGift size={28} />}
            />
          </Card.Content>
        </Card>
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
        <Card className={`${CARD} !border-0 !bg-transparent !shadow-none md:!border md:!border-[var(--color-soft-border)] md:!bg-warm-white md:!shadow-[var(--shadow-card)]`}>
          <Card.Content className="p-0 md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--sp-data-customers-soft)] text-data-customers">
                  <IconGift size={20} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{MONTHS[month - 1]}</h3>
                  <p className="text-sm text-muted">
                    {formatNumber(customers.length)} aniversariante(s)
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={exportCsv} isDisabled={customers.length === 0}>
                <IconDownload size={16} /> Exportar CSV
              </Button>
            </div>

            {customers.length === 0 ? (
              <EmptyState
                title="Nenhum aniversariante neste mês"
                description="Cadastre a data de nascimento dos clientes para vê-los aqui."
                icon={<IconGift size={28} />}
              />
            ) : (
              <DataTable
                aria-label="Aniversariantes"
                columns={columns}
                rows={customers}
                getKey={(r) => r.id}
              />
            )}
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
