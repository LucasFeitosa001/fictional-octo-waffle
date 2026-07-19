import { useMemo, useState } from 'react';
import { Button, Card, Chip, ListBox, Modal, Select } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { DateField } from '../../components/DateRangeFilter';
import {
  IconDownload,
  IconReceipt,
  IconPercent,
  IconWallet,
} from '../../components/icons';
import { formatDate, formatMoney, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useProfessionals } from '../../lib/queries';
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

const CARD_CLASS =
  'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

const STATUS_OPTIONS = [
  { id: '', name: 'Todos os status' },
  { id: 'open', name: 'Em aberto' },
  { id: 'paid', name: 'Pago' },
];

const ENTRY_STATUS_LABEL: Record<CommissionEntry['status'], string> = {
  open: 'Em aberto',
  paid: 'Pago',
  reversed: 'Estornado',
};

export function ComissoesResumoPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<CommissionSummaryRow | null>(null);

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

  const profOptions = useMemo(
    () => [
      { id: '', name: 'Todos os profissionais' },
      ...(professionals.data?.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    ],
    [professionals.data],
  );

  const rows = summary.data?.data ?? [];
  const ov = overview.data;

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
    { key: 'vendido', header: 'Valor vendido', render: (r) => formatMoney(r.valorVendido) },
    { key: 'comissao', header: 'Comissão', render: (r) => formatMoney(r.comissao) },
    { key: 'bonus', header: 'Bônus', render: (r) => formatMoney(r.bonus) },
    {
      key: 'total',
      header: 'Total',
      render: (r) => <span className="font-semibold text-foreground">{formatMoney(r.total)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Chip color={r.status === 'paid' ? 'success' : 'warning'} variant="soft" size="sm">
          {r.status === 'paid' ? 'Pago' : 'Em aberto'}
        </Chip>
      ),
    },
    {
      key: 'signed',
      header: 'Assinatura',
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
      <PageHeader
        title="Comissões"
        subtitle="Resumo por profissional"
        actions={
          <Button
            variant="outline"
            onClick={exportCsv}
            isDisabled={(entries.data ?? []).length === 0}
          >
            <IconDownload size={16} /> Exportar CSV
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatusCard
          label="Em aberto"
          hint="Disponível para pagamento"
          value={formatMoney(ov?.emAberto.total ?? 0)}
          count={ov?.emAberto.count ?? 0}
          tone="warning"
          loading={overview.isLoading}
        />
        <StatusCard
          label="A liberar"
          hint="Aguardando disponibilidade"
          value={formatMoney(ov?.aLiberar.total ?? 0)}
          count={ov?.aLiberar.count ?? 0}
          tone="muted"
          loading={overview.isLoading}
        />
        <StatusCard
          label="Pagas"
          hint="Comissões já quitadas"
          value={formatMoney(ov?.pagas.total ?? 0)}
          count={ov?.pagas.count ?? 0}
          tone="success"
          loading={overview.isLoading}
        />
      </div>

      <Card className={CARD_CLASS}>
        <Card.Content className="p-4">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Field label="De">
              <DateField value={from} max={to || undefined} onChange={setFrom} className="min-w-0" />
            </Field>
            <Field label="Até">
              <DateField value={to} min={from || undefined} onChange={setTo} className="min-w-0" />
            </Field>
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
          </div>

          {error && (
            <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Comissões por profissional
            </h3>
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
        </Card.Content>
      </Card>

      <DetailModal
        row={detailFor}
        from={from}
        to={to}
        status={status}
        onClose={() => setDetailFor(null)}
      />
    </div>
  );
}

function StatusCard({
  label,
  hint,
  value,
  count,
  tone,
  loading,
}: {
  label: string;
  hint: string;
  value: string;
  count: number;
  tone: 'warning' | 'success' | 'muted';
  loading?: boolean;
}) {
  const accent =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-[#a67c1e]'
        : 'text-foreground';
  return (
    <Card className={CARD_CLASS}>
      <Card.Content className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted">{label}</span>
          <Chip
            color={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'default'}
            variant="soft"
            size="sm"
          >
            {count}
          </Chip>
        </div>
        <div className={`mt-2 text-2xl font-bold ${accent}`}>
          {loading ? '—' : value}
        </div>
        <div className="mt-1 text-xs text-muted">{hint}</div>
      </Card.Content>
    </Card>
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
      it.orderItems.length === 0
        ? '—'
        : it.orderItems.map((oi) => oi.name).join(', '),
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

function DetailModal({
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
    <Modal isOpen={row != null} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container
          placement="center"
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Comissão — {row?.professionalName}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {/* Card de comissão do profissional */}
              <div className="rounded-lg border border-[var(--color-soft-border)] bg-white p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Metric label="Bonificações" value={formatMoney(d?.totals.bonus ?? 0)} />
                  <Metric label="Comissão" value={formatMoney(d?.totals.comissao ?? 0)} />
                  <Metric
                    label="Total"
                    value={formatMoney(d?.totals.total ?? 0)}
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
                <h4 className="text-sm font-semibold text-foreground">
                  Itens que geraram comissão
                </h4>
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
            </Modal.Body>
            <Modal.Footer className="flex justify-end">
              <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                Fechar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className={strong ? 'text-lg font-bold text-[#a67c1e]' : 'text-base font-semibold text-foreground'}>
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
