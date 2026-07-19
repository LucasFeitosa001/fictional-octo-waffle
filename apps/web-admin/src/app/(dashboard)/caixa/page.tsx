'use client';

import { Card, Chip } from '@heroui/react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { IconCash } from '@/components/icons';
import {
  useCashHistory,
  useOpenCash,
  type CashRegisterRow,
} from '@/lib/queries/financeiro';
import { formatDateTime, formatMoney } from '@/lib/format';

export default function CaixaPage() {
  const history = useCashHistory();
  const open = useOpenCash();
  const rows = history.data?.data ?? [];
  const openCash = open.data;

  const columns: Column<CashRegisterRow>[] = [
    {
      key: 'number',
      header: 'Caixa',
      isRowHeader: true,
      render: (c) => <span className="font-semibold text-foreground">#{c.number}</span>,
    },
    { key: 'opened', header: 'Abertura', render: (c) => formatDateTime(c.openedAt) },
    { key: 'closed', header: 'Fechamento', render: (c) => formatDateTime(c.closedAt) },
    { key: 'opening', header: 'Saldo inicial', render: (c) => formatMoney(c.openingBalance) },
    { key: 'counted', header: 'Saldo conferido', render: (c) => formatMoney(c.countedBalance) },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <Chip color={c.status === 'open' ? 'success' : 'default'} variant="soft" size="sm">
          {c.status === 'open' ? 'Aberto' : 'Fechado'}
        </Chip>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Caixa"
        subtitle="Abertura, conferência e histórico"
      />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="db-card">
          <Card.Content className="p-5">
            <div className="text-sm font-medium text-muted">Caixa aberto</div>
            {open.isLoading ? (
              <div className="mt-2 text-sm text-muted">Carregando…</div>
            ) : openCash ? (
              <>
                <div className="mt-1 text-2xl font-bold text-foreground">#{openCash.number}</div>
                <div className="mt-1 text-sm text-muted">
                  Aberto em {formatDateTime(openCash.openedAt)}
                </div>
                <div className="mt-1 text-sm text-muted">
                  Saldo inicial {formatMoney(openCash.openingBalance)}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-muted">Nenhum caixa aberto no momento.</div>
            )}
          </Card.Content>
        </Card>
        <Card className="db-card">
          <Card.Content className="p-5">
            <div className="text-sm font-medium text-muted">Total de caixas</div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {history.data?.total ?? 0}
            </div>
            <div className="mt-1 text-sm text-muted">Histórico de aberturas e fechamentos</div>
          </Card.Content>
        </Card>
      </div>

      <Card className="db-card">
        <Card.Content className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Histórico de caixa</h3>
          {history.isLoading ? (
            <LoadingState />
          ) : history.isError ? (
            <ErrorState onRetry={() => history.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconCash size={32} />}
              title="Nenhum caixa registrado"
              description="Abra um caixa para começar a registrar movimentações."
            />
          ) : (
            <DataTable
              aria-label="Histórico de caixa"
              columns={columns}
              rows={rows}
              getKey={(c) => c.id}
            />
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
