import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PageHeader } from '../../components/PageHeader';
import {
  IconCheck,
  IconChevron,
  IconDownload,
  IconTag,
  IconUsers,
} from '../../components/icons';
import { formatDate, formatMoney } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useRelatorioClientes, type RelatorioClienteRow } from '../../lib/queries/relatorios';
import { BackToReports, CARD } from './reportShared';
import { DateRangePicker } from '../../components/DatePicker';

/* ------------------------------------------------------------------ types -- */

type Balance = 'all' | 'with_balance';
type Status = 'all' | 'active' | 'inactive';


// Ordem/labels/values idênticos ao Belasis (checkbox group `columns`).
const COLUMN_DEFS: { value: string; label: string; get: (r: RelatorioClienteRow) => string }[] = [
  { value: 'phone1', label: 'Telefone', get: (r) => r.phone ?? '' },
  { value: 'phone2', label: 'Celular', get: (r) => r.phone ?? '' },
  { value: 'email', label: 'E-mail', get: (r) => r.email ?? '' },
  { value: 'cpf', label: 'CPF', get: (r) => r.cpf ?? '' },
  { value: 'rg', label: 'RG', get: (r) => r.rg ?? '' },
  { value: 'birthday', label: 'Aniversário', get: (r) => (r.birthday ? formatDate(r.birthday) : '') },
  { value: 'address', label: 'Endereço', get: (r) => r.street ?? '' },
  { value: 'number', label: 'Número', get: (r) => r.number ?? '' },
  { value: 'district', label: 'Bairro', get: (r) => r.district ?? '' },
  { value: 'city', label: 'Cidade', get: (r) => r.city ?? '' },
  { value: 'state', label: 'Estado', get: (r) => r.state ?? '' },
  { value: 'balance_cents', label: 'Crédito', get: (r) => formatMoney(r.creditBalance) },
  { value: 'created_at', label: 'Data de criação', get: (r) => formatDate(r.createdAt) },
  { value: 'customer_tags', label: 'Hashtags', get: (r) => r.tags.join(', ') },
  { value: 'packages_count', label: 'Qtd. de pacotes', get: (r) => String(r.packagesCount) },
  { value: 'sales_count', label: 'Qtd. de comandas', get: (r) => String(r.ordersCount) },
  { value: 'packages_total_cents', label: 'Valor total de pacotes', get: (r) => formatMoney(r.packagesTotal) },
  { value: 'sales_total_cents', label: 'Valor total de comandas', get: (r) => formatMoney(r.ordersTotal) },
];


// Colunas pré-marcadas no Belasis.
const DEFAULT_COLUMNS = ['phone2', 'birthday', 'balance_cents'];

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

/* --------------------------------------------------------- form primitives -- */

/** Rótulo de campo estilo antd-form (label acima do controle). */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-start sm:gap-4">
      <label className="pt-1.5 text-sm font-medium text-foreground">{label}</label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Radio segmentado (ant-radio-button-group): pills conectados, themeable. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-line bg-warm-white">
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'px-4 py-1.5 text-sm font-medium transition-colors',
              i > 0 ? 'border-l border-line' : '',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-ink hover:text-gold-strong',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Checkbox estilo antd, themeable (fill primary + check branco). */
function CheckboxItem({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink select-none">
      <span
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-line bg-warm-white',
        ].join(' ')}
      >
        {checked && <IconCheck size={12} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={onToggle}
      />
      {label}
    </label>
  );
}

/* -------------------------------------------------------------------- page -- */

export function ClientesPage() {
  const [range, setRange] = useState(defaultRange);
  const [balance, setBalance] = useState<Balance>('all');
  const [status, setStatus] = useState<Status>('all');
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Endpoint próprio do relatório: a lista COMPLETA de clientes com todas as
  // colunas. Antes lia `overview.newCustomers` — clientes NOVOS do dashboard —
  // e num salão que não cadastrou ninguém no período a lista vinha vazia e o
  // botão ficava desabilitado. Os três filtros vão para o servidor.
  const query = useRelatorioClientes({
    from: range.from,
    to: range.to,
    status,
    balance,
  });
  const customers = query.data ?? [];

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  function toggleColumn(v: string) {
    setColumns((cur) =>
      cur.includes(v) ? cur.filter((c) => c !== v) : [...cur, v],
    );
  }

  function gerarRelatorio() {
    setMenuOpen(false);
    const selected = COLUMN_DEFS.filter((c) => columns.includes(c.value));
    downloadCsv(
      `clientes-${range.from}_a_${range.to}`,
      [
        { header: 'Cliente', value: (r: RelatorioClienteRow) => r.name },
        ...selected.map((c) => ({
          header: c.label,
          value: (r: RelatorioClienteRow) => c.get(r),
        })),
      ],
      customers,
    );
  }

  return (
    <div>
      <BackToReports />
      <PageHeader
        title="Clientes"
        subtitle="Gere a lista completa de clientes com as colunas desejadas"
      />

      <div className={`rounded-xl p-5 sm:p-6 ${CARD}`}>
        <div className="space-y-5">
          {/* Clientes (balance) */}
          <Field label="Clientes">
            <Segmented<Balance>
              value={balance}
              onChange={setBalance}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'with_balance', label: 'Com saldo' },
              ]}
            />
          </Field>

          {/* Criado em (dates) — range picker */}
          <Field label="Criado em">
            <DateRangePicker
              from={range.from}
              to={range.to}
              onChange={setRange}
              ariaLabel="Criado em"
              className="max-w-md"
            />
          </Field>

          {/* Formato do relatório (type_of_clients) */}
          <Field label="Formato do relatório">
            <Segmented<Status>
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'active', label: 'Ativos' },
                { value: 'inactive', label: 'Inativos' },
              ]}
            />
          </Field>

          {/* Hashtags */}
          <Field label="Hashtags">
            {/* TODO: sem endpoint de hashtags no overview — placeholder fiel ao Belasis. */}
            <div className="flex w-full max-w-md items-center gap-2 rounded-lg border border-line bg-warm-white px-3 py-2 text-sm text-muted">
              <IconTag size={16} className="shrink-0" />
              <span>Selecione as hashtags</span>
            </div>
          </Field>

          {/* Colunas (columns) — checkbox group 3 colunas */}
          <Field label="Colunas">
            <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 md:grid-cols-3">
              {COLUMN_DEFS.map((c) => (
                <CheckboxItem
                  key={c.value}
                  label={c.label}
                  checked={columns.includes(c.value)}
                  onToggle={() => toggleColumn(c.value)}
                />
              ))}
            </div>
          </Field>
        </div>

        {/* Gerar relatório + dropdown (ant-space-compact) */}
        <div className="mt-6 flex justify-end border-t border-line pt-5">
          <div ref={menuRef} className="relative inline-flex">
            <button
              type="button"
              onClick={gerarRelatorio}
              disabled={query.isLoading || customers.length === 0}
              className="inline-flex items-center gap-2 rounded-l-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-strong disabled:opacity-50"
            >
              <IconDownload size={16} />
              Gerar relatório
            </button>
            <button
              type="button"
              aria-label="Mais opções"
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex items-center rounded-r-lg border-l border-white/20 bg-primary px-2 py-2 text-primary-foreground transition-colors hover:bg-primary-strong"
            >
              <IconChevron size={16} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-52 overflow-hidden rounded-lg border border-line bg-warm-white py-1 shadow-[var(--shadow-pop)]">
                <button
                  type="button"
                  onClick={gerarRelatorio}
                  disabled={customers.length === 0}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-canvas disabled:opacity-50"
                >
                  <IconDownload size={15} /> Exportar CSV
                </button>
                <button
                  type="button"
                  disabled
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted"
                  title="Em breve"
                >
                  <IconUsers size={15} /> Exportar PDF (em breve)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
