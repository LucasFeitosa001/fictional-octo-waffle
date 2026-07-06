import { useMemo, useState } from 'react';
import { Button, Card, Chip, ListBox, Select } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { DateField } from '../../components/DateRangeFilter';
import { IconDollar, IconDownload, IconPercent, IconWallet } from '../../components/icons';
import { formatDate, formatMoney, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useProfessionals } from '../../lib/queries';
import {
  useCommissionEntries,
  useCommissionSummary,
  useCreateCommissionPayment,
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

  const professionals = useProfessionals();
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
  const totals = summary.data?.totals;

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
        <Button
          variant="primary"
          size="sm"
          isDisabled={r.status === 'paid' || r.total <= 0 || pay.isPending}
          onClick={() => handlePay(r)}
        >
          <IconWallet size={15} /> Pagar
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Comissões"
        subtitle="Resumo por profissional"
        onRefresh={() => {
          summary.refetch();
          entries.refetch();
        }}
        isRefreshing={summary.isFetching || entries.isFetching}
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

      {totals && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            icon={<IconDollar size={16} />}
            label="Valor vendido"
            value={formatMoney(totals.valorVendido)}
          />
          <SummaryCard
            icon={<IconPercent size={16} />}
            label="Comissão"
            value={formatMoney(totals.comissao)}
          />
          <SummaryCard
            icon={<IconWallet size={16} />}
            label="Total a pagar"
            value={formatMoney(totals.total)}
            highlight
          />
        </div>
      )}

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
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={CARD_CLASS}>
      <Card.Content className="p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
            {icon}
          </span>
          <span className="text-sm font-medium text-muted">{label}</span>
        </div>
        <div
          className={`mt-2 text-2xl font-bold ${
            highlight ? 'text-[#a67c1e]' : 'text-foreground'
          }`}
        >
          {value}
        </div>
      </Card.Content>
    </Card>
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
