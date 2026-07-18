import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Chip } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { IconCash, IconClock, IconWallet } from '../../components/icons';
import { useCashHistory, useOpenCash } from '../../lib/queries';
import { formatDateTime, formatMoney } from '../../lib/format';
import type { CashRegisterRow } from '../../lib/types';

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

export function CaixasAbertosPage() {
  const navigate = useNavigate();
  const open = useOpenCash();
  const history = useCashHistory();

  const openRows = useMemo(
    () => (history.data?.data ?? []).filter((c) => c.status === 'open'),
    [history.data],
  );

  const openTotal = useMemo(
    () => openRows.reduce((sum, c) => sum + Number(c.openingBalance ?? 0), 0),
    [openRows],
  );

  const columns: Column<CashRegisterRow>[] = [
    {
      key: 'number',
      header: 'Caixa',
      isRowHeader: true,
      render: (c) => <span className="font-semibold text-foreground">#{c.number}</span>,
    },
    { key: 'opened', header: 'Aberto em', render: (c) => formatDateTime(c.openedAt) },
    { key: 'opening', header: 'Saldo inicial', render: (c) => formatMoney(c.openingBalance) },
    {
      key: 'status',
      header: 'Status',
      render: () => (
        <Chip color="success" variant="soft" size="sm">
          Aberto
        </Chip>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Caixas abertos"
        subtitle="Caixas em aberto no momento"
        onRefresh={() => {
          open.refetch();
          history.refetch();
        }}
        isRefreshing={history.isFetching || open.isFetching}
        actions={
          <Button variant="outline" onClick={() => navigate('/financeiro/caixas/historico')}>
            <IconClock size={16} /> Histórico
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className={CARD}>
          <Card.Content className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
                <IconCash size={18} />
              </span>
              <span className="text-sm font-medium text-muted">Caixas abertos</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{openRows.length}</div>
            <div className="mt-1 text-sm text-muted">Em aberto neste momento</div>
          </Card.Content>
        </Card>
        <Card className={CARD}>
          <Card.Content className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
                <IconWallet size={18} />
              </span>
              <span className="text-sm font-medium text-muted">Saldo inicial somado</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{formatMoney(openTotal)}</div>
            <div className="mt-1 text-sm text-muted">Somatório dos saldos de abertura</div>
          </Card.Content>
        </Card>
      </div>

      <Card className={CARD}>
        <Card.Content className="p-4">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Caixas em aberto</h3>
          {history.isLoading ? (
            <LoadingState />
          ) : history.isError ? (
            <ErrorState onRetry={() => history.refetch()} />
          ) : openRows.length === 0 ? (
            <EmptyState
              icon={<IconCash size={32} />}
              title="Nenhum caixa aberto"
              description="Abra um caixa para começar a registrar as movimentações do dia."
            />
          ) : (
            <DataTable
              aria-label="Caixas abertos"
              columns={columns}
              rows={openRows}
              getKey={(c) => c.id}
            />
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
