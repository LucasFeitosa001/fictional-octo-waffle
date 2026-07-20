import { useState } from 'react';
import { Button, Card } from '@heroui/react';
import { EmptyState, LoadingState } from '../../components/States';
import { DataTable, type Column } from '../../components/DataTable';
import { IconChevron, IconDownload, IconGift, IconPhone } from '../../components/icons';
import { formatNumber, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useReportsBirthdays, type BirthdayItem } from '../../lib/queries/relatorios';
import { BackToReports, CARD } from './reportShared';

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

const MONTHS_ABBR = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** Status do cliente, espelhando o radio-group do Belasis (Todos/Ativos/Inativos). */
type Status = 'all' | 'actives' | 'inactives';
const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'actives', label: 'Ativos' },
  { value: 'inactives', label: 'Inativos' },
];

/** "YYYY-MM-DD" -> "01 jul, 2026" (formato do range picker do Belasis). */
function formatBrLong(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d} ${MONTHS_ABBR[Number(mo) - 1]}, ${y}`;
}

/** Período inicial: primeiro → último dia do mês corrente. */
function defaultRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: isoDate(from), to: isoDate(to) };
}

/** Campo de data cru (native) estilizado como o range do Belasis. */
function RangeInput({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <div className="relative flex-1">
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [color-scheme:light]"
        aria-label="Data"
      />
      <span className="pointer-events-none block truncate text-center text-sm text-ink sm:text-base">
        {formatBrLong(value)}
      </span>
    </div>
  );
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
        <span className="inline-flex items-center rounded-md bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] px-2 py-0.5 text-xs font-semibold text-gold-strong">
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
              <div className="flex h-10 items-center rounded-xl border border-line bg-warm-white px-[11px]">
                <RangeInput
                  value={range.from}
                  max={range.to || undefined}
                  onChange={(v) => setRange((r) => ({ ...r, from: v }))}
                />
                <IconChevron size={16} className="-rotate-90 shrink-0 text-muted" />
                <RangeInput
                  value={range.to}
                  min={range.from || undefined}
                  onChange={(v) => setRange((r) => ({ ...r, to: v }))}
                />
              </div>
            </div>

            {/* Gerar relatório — botão primário block */}
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
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--sp-primary)_15%,transparent)] text-gold-strong">
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
