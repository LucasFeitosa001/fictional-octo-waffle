import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Chip, ListBox, Select } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { DataTable, type Column } from '../../components/DataTable';
import { Drawer } from '../../components/Drawer';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { DateField } from '../../components/DateRangeFilter';
import { HelpTooltip } from '../../components/HelpTooltip';
import {
  IconChart,
  IconChevron,
  IconCircleCheck,
  IconDownload,
  IconFilter,
  IconHome,
  IconPercent,
  IconReceipt,
  IconSearch,
  IconSettings,
  IconWallet,
} from '../../components/icons';
import { formatDate, formatMoney, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useProfessionals } from '../../lib/queries';
import { useSetPageActions } from '../../layout/PageActions';
import {
  useCommissionDetail,
  useCommissionEntries,
  useCommissionOverview,
  useCommissionSummary,
  useCreateCommissionPayment,
  type CommissionDetailItem,
  type CommissionEntry,
  type CommissionSummaryRow,
} from '../../lib/queries/comissoes';

/**
 * Paleta FIXA dos cards de status do Belasis (data-viz, independente do tema —
 * mesma lógica de `useThemeColors`). Azul = em aberto, verde = pagas, laranja =
 * a liberar. Reproduz 1:1 os cards coloridos da tela "Resumo" do Belasis.
 */
const CARD_COLORS = {
  open: '#2196F3',
  paid: '#5cb85c',
  release: '#f5a139',
} as const;

const TO_RELEASE_TOOLTIP =
  'Comissões que ainda serão liberadas conforme o recebimento das vendas ' +
  '(parcelas a receber). Ficam disponíveis para pagamento quando o valor é recebido.';

const CARD_CLASS =
  'border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]';

const STATUS_OPTIONS = [
  { id: '', name: 'Todos os status' },
  { id: 'open', name: 'Em aberto' },
  { id: 'paid', name: 'Pago' },
];

// Abas do topo (idênticas às do Belasis mobile). As de status filtram o resumo;
// "Configurações" navega para a rota de config de comissões.
const TABS = [
  { id: '', label: 'Resumo', icon: IconHome },
  { id: 'open', label: 'Comissões em aberto', icon: IconChart },
  { id: 'paid', label: 'Comissões pagas', icon: IconCircleCheck },
  { id: 'settings', label: 'Configurações', icon: IconSettings, nav: '/commissions/settings' },
] as const;

const ENTRY_STATUS_LABEL: Record<CommissionEntry['status'], string> = {
  open: 'Em aberto',
  paid: 'Pago',
  reversed: 'Estornado',
};

/** "19 jun, 2026" — formato curto usado na barra de período do Belasis. */
function shortDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(d)
    .replace('.', '');
}

export function ComissoesResumoPage() {
  const navigate = useNavigate();
  // Belasis abre a tela já com um período padrão de 30 dias (ex.: "19 jun → 19 jul"),
  // e não com o campo vazio. Reproduz o mesmo comportamento da captura.
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDate(d);
  });
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [professionalId, setProfessionalId] = useState('');
  const [status, setStatus] = useState('');
  const [showPrevious, setShowPrevious] = useState(false); // TODO: sem wiring de query ainda
  const [error, setError] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<CommissionSummaryRow | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const professionals = useProfessionals();
  const overview = useCommissionOverview({
    from: from || undefined,
    to: to || undefined,
    professionalId: professionalId || undefined,
  });
  const summary = useCommissionSummary({
    from: from || undefined,
    to: to || undefined,
    professionalId: professionalId || undefined,
    status: status || undefined,
  });
  // Entries power the CSV export. The endpoint supports status + professionalId
  // (no date range), so the export covers the selected professional/status.
  const entries = useCommissionEntries({
    status: status || undefined,
    professionalId: professionalId || undefined,
  });
  const pay = useCreateCommissionPayment();

  function exportCsv() {
    const rowsToExport = entries.data ?? [];
    downloadCsv<CommissionEntry>(
      `comissoes-${isoDate(new Date())}`,
      [
        { header: 'Profissional', value: (e) => e.professional?.name ?? e.professionalId },
        { header: 'Base', value: (e) => Number(e.baseAmount).toFixed(2) },
        { header: 'Comissão', value: (e) => Number(e.commissionAmount).toFixed(2) },
        { header: 'Bônus', value: (e) => Number(e.bonusAmount).toFixed(2) },
        { header: 'Status', value: (e) => ENTRY_STATUS_LABEL[e.status] },
        { header: 'Assinado', value: (e) => (e.signed ? 'Sim' : 'Não') },
        { header: 'Competência', value: (e) => formatDate(e.competenceDate) },
        { header: 'Disponível em', value: (e) => formatDate(e.availableDate) },
      ],
      rowsToExport,
    );
  }

  // No mobile (<768px) as ações contextuais desta página vivem na BottomNav
  // (padrão Belasis). Disparam exatamente os mesmos handlers dos botões desktop.
  const hasEntries = (entries.data ?? []).length > 0;
  useSetPageActions(
    [
      {
        key: 'filtros',
        label: 'Filtros',
        icon: <IconFilter size={22} />,
        onClick: () => setFilterOpen(true),
      },
      {
        key: 'exportar',
        label: 'Exportar CSV',
        icon: <IconDownload size={22} />,
        onClick: exportCsv,
        disabled: !hasEntries,
      },
    ],
    [hasEntries],
  );

  const profOptions = useMemo(
    () => [
      { id: '', name: 'Todos os profissionais' },
      ...(professionals.data?.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    ],
    [professionals.data],
  );

  const rows = summary.data?.data ?? [];
  const ov = overview.data;

  const rangeLabel =
    from && to ? `${shortDate(from)} → ${shortDate(to)}` : 'Selecionar período';

  async function handlePay(row: CommissionSummaryRow) {
    setError(null);
    try {
      await pay.mutateAsync({
        professionalId: row.professionalId,
        amount: row.total,
      });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível registrar o pagamento.',
      );
    }
  }

  const columns: Column<CommissionSummaryRow>[] = [
    {
      key: 'name',
      header: 'Profissional',
      isRowHeader: true,
      render: (r) => <span className="font-medium text-foreground">{r.professionalName}</span>,
    },
    {
      key: 'vendido',
      header: (
        <span className="inline-flex items-center">
          Valor vendido
          <HelpTooltip>Soma bruta vendida pelo profissional no período.</HelpTooltip>
        </span>
      ),
      render: (r) => formatMoney(r.valorVendido),
    },
    {
      key: 'comissao',
      header: (
        <span className="inline-flex items-center">
          Comissão
          <HelpTooltip>Percentual sobre o valor vendido, conforme regra configurada.</HelpTooltip>
        </span>
      ),
      render: (r) => formatMoney(r.comissao),
    },
    {
      key: 'bonus',
      header: (
        <span className="inline-flex items-center">
          Bônus
          <HelpTooltip>Bonificações extras somadas à comissão do profissional.</HelpTooltip>
        </span>
      ),
      render: (r) => formatMoney(r.bonus),
    },
    {
      key: 'total',
      header: (
        <span className="inline-flex items-center">
          Total
          <HelpTooltip>Comissão + bônus. Valor líquido a pagar ao profissional.</HelpTooltip>
        </span>
      ),
      render: (r) => <span className="font-semibold text-foreground">{formatMoney(r.total)}</span>,
    },
    {
      key: 'status',
      header: (
        <span className="inline-flex items-center">
          Status
          <HelpTooltip>Situação da comissão: em aberto (a pagar) ou já paga.</HelpTooltip>
        </span>
      ),
      render: (r) => (
        <Chip color={r.status === 'paid' ? 'success' : 'warning'} variant="soft" size="sm">
          {r.status === 'paid' ? 'Pago' : 'Em aberto'}
        </Chip>
      ),
    },
    {
      key: 'signed',
      header: (
        <span className="inline-flex items-center">
          Assinatura
          <HelpTooltip>Indica se o profissional assinou digitalmente o recibo da comissão.</HelpTooltip>
        </span>
      ),
      render: (r) => (
        <Chip color={r.signed ? 'success' : 'default'} variant="soft" size="sm">
          {r.signed ? 'Assinado' : 'Não assinado'}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={() => setDetailFor(r)}>
            <IconReceipt size={15} /> Detalhes
          </Button>
          <Button
            variant="primary"
            size="sm"
            isDisabled={r.status === 'paid' || r.total <= 0 || pay.isPending}
            onClick={() => handlePay(r)}
          >
            <IconWallet size={15} /> Pagar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Cabeçalho + abas (Resumo / Em aberto / Pagas / Configurações) */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">
            Comissões
          </h1>
          <Button
            variant="outline"
            className="hidden md:inline-flex"
            onClick={exportCsv}
            isDisabled={!hasEntries}
          >
            <IconDownload size={16} /> Exportar CSV
          </Button>
        </div>

        <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {TABS.map((tab) => {
            const active = 'nav' in tab ? false : status === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id || 'resumo'}
                type="button"
                onClick={() => ('nav' in tab ? navigate(tab.nav) : setStatus(tab.id))}
                className={[
                  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                    : 'border-line bg-card text-muted-ink hover:bg-canvas',
                ].join(' ')}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de período (clicável — abre o drawer de filtros) */}
      <button
        type="button"
        onClick={() => setFilterOpen(true)}
        className={`mb-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-base font-medium text-foreground ${CARD_CLASS}`}
      >
        <span>{rangeLabel}</span>
        <IconChevron size={16} className="text-muted" />
      </button>

      {/* Cards coloridos de status (mobile-first: empilhados; desktop: 3 colunas) */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Comissões em aberto"
          value={formatMoney(ov?.emAberto.total ?? 0)}
          color={CARD_COLORS.open}
          tooltip="Comissões geradas e ainda não pagas ao profissional."
          loading={overview.isLoading}
        />
        <KpiCard
          label="Comissões pagas"
          value={formatMoney(ov?.pagas.total ?? 0)}
          color={CARD_COLORS.paid}
          tooltip="Comissões já quitadas no período filtrado."
          loading={overview.isLoading}
        />
        <KpiCard
          label="Comissões a liberar"
          value={formatMoney(ov?.aLiberar.total ?? 0)}
          color={CARD_COLORS.release}
          tooltip={TO_RELEASE_TOOLTIP}
          loading={overview.isLoading}
        />
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Resumo por profissional (data-wiring preservado) */}
      <div className={`rounded-2xl p-4 ${CARD_CLASS}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Comissões por profissional</h3>
          <span className="text-xs text-muted">{rows.length} resultado(s)</span>
        </div>

        {summary.isLoading ? (
          <LoadingState />
        ) : summary.isError ? (
          <ErrorState onRetry={() => summary.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IconPercent size={32} />}
            title="Nenhuma comissão no período"
            description="Ajuste os filtros ou finalize comandas para gerar comissões."
          />
        ) : (
          <DataTable
            aria-label="Resumo de comissões"
            columns={columns}
            rows={rows}
            getKey={(r) => r.professionalId}
          />
        )}
      </div>

      {/* Drawer lateral de filtros (abre da direita) */}
      <Drawer
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filtros"
        footer={
          <>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setFilterOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" className="w-full sm:w-auto" onClick={() => setFilterOpen(false)}>
              <IconSearch size={16} /> Buscar comissões
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted">Selecione um período e escolha o profissional</p>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data inicial">
              <DateField value={from} max={to || undefined} onChange={setFrom} className="min-w-0" />
            </Field>
            <Field label="Data final">
              <DateField value={to} min={from || undefined} onChange={setTo} className="min-w-0" />
            </Field>
          </div>

          <Field label="Profissional">
            <Select
              aria-label="Profissional"
              selectedKey={professionalId || ''}
              onSelectionChange={(k) => setProfessionalId(k ? String(k) : '')}
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {profOptions.map((o) => (
                    <ListBox.Item key={o.id || 'all'} id={o.id} textValue={o.name}>
                      {o.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </Field>

          <Field label="Status">
            <Select
              aria-label="Status"
              selectedKey={status || ''}
              onSelectionChange={(k) => setStatus(k ? String(k) : '')}
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {STATUS_OPTIONS.map((o) => (
                    <ListBox.Item key={o.id || 'all'} id={o.id} textValue={o.name}>
                      {o.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </Field>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={showPrevious}
              onChange={(e) => setShowPrevious(e.target.checked)}
              className="h-4 w-4 accent-[var(--sp-primary)]"
            />
            Mostrar comissões anteriores
          </label>
        </div>
      </Drawer>

      {/* Drawer lateral de detalhe do profissional */}
      <DetailDrawer
        row={detailFor}
        from={from}
        to={to}
        status={status}
        onClose={() => setDetailFor(null)}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
  tooltip,
  loading,
}: {
  label: string;
  value: string;
  color: string;
  tooltip?: string;
  loading?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 text-center shadow-[rgba(99,99,99,0.2)_0_2px_8px_0]"
      style={{ background: color }}
    >
      <div className="flex items-center justify-center gap-1 text-[1.05rem] font-medium text-white">
        <span>{label}</span>
        {tooltip && (
          <HelpTooltip className="ml-1 inline-flex items-center text-white opacity-90 hover:opacity-100">
            {tooltip}
          </HelpTooltip>
        )}
      </div>
      <div className="mt-1 text-2xl font-bold text-white">{loading ? '—' : value}</div>
    </div>
  );
}

const DETAIL_COLUMNS: Column<CommissionDetailItem>[] = [
  {
    key: 'date',
    header: 'Data',
    isRowHeader: true,
    render: (it) => <span className="font-medium text-foreground">{formatDate(it.date)}</span>,
  },
  {
    key: 'comanda',
    header: 'Comanda',
    render: (it) => (it.orderNumber != null ? `#${it.orderNumber}` : '—'),
  },
  { key: 'cliente', header: 'Cliente', render: (it) => it.customerName ?? '—' },
  {
    key: 'servico',
    header: 'Serviço',
    render: (it) =>
      it.orderItems.length === 0 ? '—' : it.orderItems.map((oi) => oi.name).join(', '),
  },
  {
    key: 'qtd',
    header: 'Qtd',
    render: (it) => {
      const q = it.orderItems.reduce((s, oi) => s + oi.quantity, 0);
      return q > 0 ? String(q) : '—';
    },
  },
  {
    key: 'valor',
    header: 'Comissão',
    render: (it) => (
      <span className="font-semibold text-foreground">
        {formatMoney(it.commissionAmount + it.bonusAmount)}
      </span>
    ),
  },
];

function DetailDrawer({
  row,
  from,
  to,
  status,
  onClose,
}: {
  row: CommissionSummaryRow | null;
  from: string;
  to: string;
  status: string;
  onClose: () => void;
}) {
  const detail = useCommissionDetail(row?.professionalId ?? null, {
    from: from || undefined,
    to: to || undefined,
    status: status || undefined,
  });
  const d = detail.data;

  return (
    <Drawer
      isOpen={row != null}
      onClose={onClose}
      title={`Comissão — ${row?.professionalName ?? ''}`}
      widthClass="sm:w-[560px]"
      footer={
        <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Card de comissão do profissional */}
        <div className="rounded-lg border border-[var(--color-soft-border)] bg-white p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric
              label="Bonificações"
              value={formatMoney(d?.totals.bonus ?? 0)}
              help="Valores extras somados à comissão (metas, campanhas, prêmios)."
            />
            <Metric
              label="Comissão"
              value={formatMoney(d?.totals.comissao ?? 0)}
              help="Comissão calculada sobre o serviço/produto vendido."
            />
            <Metric
              label="Total"
              value={formatMoney(d?.totals.total ?? 0)}
              help="Valor líquido a pagar (comissão + bonificações)."
              strong
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-medium text-muted">Assinatura digital</span>
            <Chip color={d?.signed ? 'success' : 'default'} variant="soft" size="sm">
              {d?.signed ? 'Assinado' : 'Não assinado'}
            </Chip>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Itens que geraram comissão</h4>
          <span className="text-xs text-muted">{d?.count ?? 0} item(ns)</span>
        </div>

        {detail.isLoading ? (
          <LoadingState />
        ) : detail.isError ? (
          <ErrorState onRetry={() => detail.refetch()} />
        ) : (d?.items ?? []).length === 0 ? (
          <EmptyState
            icon={<IconReceipt size={32} />}
            title="Nenhum item no período"
            description="Não há lançamentos de comissão para este profissional no filtro atual."
          />
        ) : (
          <DataTable
            aria-label="Itens que geraram comissão"
            columns={DETAIL_COLUMNS}
            rows={d?.items ?? []}
            getKey={(it) => it.id}
          />
        )}
      </div>
    </Drawer>
  );
}

function Metric({
  label,
  value,
  strong,
  help,
}: {
  label: string;
  value: string;
  strong?: boolean;
  help?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center text-xs font-medium text-muted">
        {label}
        {help && <HelpTooltip>{help}</HelpTooltip>}
      </span>
      <span
        className={
          strong
            ? 'text-lg font-bold text-gold-strong'
            : 'text-base font-semibold text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
