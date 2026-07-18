import { useMemo, useState } from 'react';
import { Card, Chip } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { DateField } from '../../components/DateRangeFilter';
import { IconCash, IconWallet } from '../../components/icons';
import { useCashRegisters, type CashHistoryRow } from '../../lib/queries/caixa';
import { formatDateTime, formatMoney, isoDate } from '../../lib/format';

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: isoDate(from), to: isoDate(to) };
}

export function CaixaHistoricoPage() {
  const history = useCashRegisters();
  const allRows = history.data?.data ?? [];

  // The cash-registers endpoint has no date param, so filter loaded history
  // client-side by openedAt.
  const [range, setRange] = useState(monthRange);
  const rows = useMemo(
    () =>
      allRows.filter((c) => {
        const day = c.openedAt?.slice(0, 10) ?? '';
        if (range.from && day && day < range.from) return false;
        if (range.to && day && day > range.to) return false;
        return true;
      }),
    [allRows, range.from, range.to],
  );

  const countedTotal = useMemo(
    () => rows.reduce((sum, c) => sum + Number(c.countedBalance ?? 0), 0),
    [rows],
  );

  const columns: Column<CashHistoryRow>[] = [
    {
      key: 'number',
      header: 'Caixa',
      isRowHeader: true,
      render: (c) => <span className="font-semibold text-foreground">#{c.number}</span>,
    },
    {
      key: 'openedBy',
      header: 'Quem abriu',
      render: (c) => c.responsibleUser?.name ?? '—',
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
        title="Histórico de caixa"
        subtitle="Aberturas, fechamentos e conferências"
        onRefresh={() => history.refetch()}
        isRefreshing={history.isFetching}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className={CARD}>
          <Card.Content className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
                <IconCash size={18} />
              </span>
              <span className="text-sm font-medium text-muted">Caixas no período</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{rows.length}</div>
            <div className="mt-1 text-sm text-muted">
              de {history.data?.total ?? allRows.length} no histórico
            </div>
          </Card.Content>
        </Card>
        <Card className={CARD}>
          <Card.Content className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
                <IconWallet size={18} />
              </span>
              <span className="text-sm font-medium text-muted">Total conferido</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{formatMoney(countedTotal)}</div>
            <div className="mt-1 text-sm text-muted">Somatório dos saldos conferidos</div>
          </Card.Content>
        </Card>
      </div>

      <Card className={CARD}>
        <Card.Content className="p-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Histórico de caixa</h3>
            <div className="flex flex-wrap items-end gap-3">
              <DateField
                label="De"
                value={range.from}
                max={range.to}
                onChange={(v) => setRange((r) => ({ ...r, from: v }))}
              />
              <DateField
                label="Até"
                value={range.to}
                min={range.from}
                onChange={(v) => setRange((r) => ({ ...r, to: v }))}
              />
            </div>
          </div>

          {history.isLoading ? (
            <LoadingState />
          ) : history.isError ? (
            <ErrorState onRetry={() => history.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconCash size={32} />}
              title="Nenhum caixa no período"
              description={
                allRows.length > 0
                  ? 'Ajuste o período para ver as movimentações.'
                  : 'Abra um caixa para começar a registrar movimentações.'
              }
            />
          ) : (
            <>
              <div className="mb-2 text-xs text-muted">{rows.length} caixa(s) no período</div>
              <DataTable
                aria-label="Histórico de caixa"
                columns={columns}
                rows={rows}
                getKey={(c) => c.id}
              />
            </>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
