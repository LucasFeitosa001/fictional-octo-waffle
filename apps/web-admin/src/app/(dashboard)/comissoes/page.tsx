'use client';

import { useMemo, useState } from 'react';
import { Button, Card, Chip, ListBox, Select } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { DateField } from '@/components/DateRangeFilter';
import { IconPercent } from '@/components/icons';
import { formatMoney } from '@/lib/format';
import { useProfessionals } from '@/lib/queries';
import {
  useCommissionSummary,
  useCreateCommissionPayment,
  type CommissionSummaryRow,
} from '@/lib/queries/comissoes';

const STATUS_OPTIONS = [
  { id: '', name: 'Todos os status' },
  { id: 'open', name: 'Em aberto' },
  { id: 'paid', name: 'Pago' },
];

export default function ComissoesResumoPage() {
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
  const pay = useCreateCommissionPayment();

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
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível registrar o pagamento.',
      );
    }
  }

  const columns: Column<CommissionSummaryRow>[] = [
    {
      key: 'name',
      header: 'Profissional',
      isRowHeader: true,
      render: (r) => (
        <span className="font-medium text-foreground">{r.professionalName}</span>
      ),
    },
    { key: 'vendido', header: 'Valor vendido', render: (r) => formatMoney(r.valorVendido) },
    { key: 'comissao', header: 'Comissão', render: (r) => formatMoney(r.comissao) },
    { key: 'bonus', header: 'Bônus', render: (r) => formatMoney(r.bonus) },
    {
      key: 'total',
      header: 'Total',
      render: (r) => (
        <span className="font-semibold text-foreground">{formatMoney(r.total)}</span>
      ),
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
          Pagar
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Comissões"
        subtitle="Resumo por profissional"
      />

      {totals && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Valor vendido" value={formatMoney(totals.valorVendido)} />
          <SummaryCard label="Comissão" value={formatMoney(totals.comissao)} />
          <SummaryCard label="Total a pagar" value={formatMoney(totals.total)} />
        </div>
      )}

      <Card className="db-card">
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="db-card">
      <Card.Content className="p-5">
        <div className="text-sm font-medium text-muted">{label}</div>
        <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
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
