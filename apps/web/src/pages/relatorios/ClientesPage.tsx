import { useState } from 'react';
import { Button, Card } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/States';
import { DataTable, type Column } from '../../components/DataTable';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { IconDownload, IconUserPlus } from '../../components/icons';
import { formatDate, formatNumber, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useReportsOverview, type NewCustomerItem } from '../../lib/queries/relatorios';
import { BackToReports, CARD } from './reportShared';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: isoDate(from), to: isoDate(to) };
}

export function ClientesPage() {
  const [range, setRange] = useState(defaultRange);
  const query = useReportsOverview(range.from, range.to);
  const d = query.data;
  const customers = d?.newCustomers ?? [];

  const columns: Column<NewCustomerItem>[] = [
    {
      key: 'name',
      header: 'Cliente',
      isRowHeader: true,
      render: (r) => <span className="font-medium text-foreground">{r.name}</span>,
    },
    {
      key: 'contact',
      header: 'Contato',
      render: (r) => <span className="text-muted">{r.phone ?? r.email ?? '—'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Cadastrado em',
      render: (r) => <span className="text-muted">{formatDate(r.createdAt)}</span>,
    },
  ];

  function exportCsv() {
    downloadCsv(
      `novos-clientes-${range.from}_a_${range.to}`,
      [
        { header: 'Cliente', value: (r: NewCustomerItem) => r.name },
        { header: 'Telefone', value: (r) => r.phone ?? '' },
        { header: 'E-mail', value: (r) => r.email ?? '' },
        { header: 'Cadastrado em', value: (r) => formatDate(r.createdAt) },
      ],
      customers,
    );
  }

  return (
    <div>
      <BackToReports />
      <PageHeader
        title="Clientes"
        subtitle="Novos clientes captados no período"
        actions={
          <Button variant="outline" onClick={exportCsv} isDisabled={customers.length === 0}>
            <IconDownload size={16} /> Exportar CSV
          </Button>
        }
      />

      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </Card.Content>
      </Card>

      {query.isLoading ? (
        <LoadingState />
      ) : (
        <>
          <div className="mb-4">
            <Card className={CARD}>
              <Card.Content className="flex items-center gap-3 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
                  <IconUserPlus size={20} />
                </span>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatNumber(d?.newCustomersCount ?? 0)}
                  </p>
                  <p className="text-sm text-muted">novos clientes no período</p>
                </div>
              </Card.Content>
            </Card>
          </div>

          <Card className={CARD}>
            <Card.Content className="p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                Lista de novos clientes
                {customers.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted">
                    (mostrando até {customers.length})
                  </span>
                )}
              </h3>
              {customers.length === 0 ? (
                <EmptyState
                  title="Nenhum novo cliente"
                  description="Nenhum cliente foi cadastrado no período selecionado."
                  icon={<IconUserPlus size={28} />}
                />
              ) : (
                <DataTable
                  aria-label="Novos clientes"
                  columns={columns}
                  rows={customers}
                  getKey={(r) => r.id}
                />
              )}
            </Card.Content>
          </Card>
        </>
      )}
    </div>
  );
}
