import { Button, Card, Chip } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/States';
import { DataTable, type Column } from '../../components/DataTable';
import { IconBox, IconDownload } from '../../components/icons';
import { formatNumber } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import {
  useReportsInventorySuggestion,
  type InventorySuggestionItem,
} from '../../lib/queries/relatorios';
import { BackToReports, CARD } from './reportShared';

export function EstoquePage() {
  const query = useReportsInventorySuggestion();
  const d = query.data;
  const items = d?.items ?? [];

  const zerados = items.filter((i) => i.stock <= 0).length;

  const columns: Column<InventorySuggestionItem>[] = [
    {
      key: 'name',
      header: 'Produto',
      isRowHeader: true,
      render: (r) => <span className="font-medium text-foreground">{r.name}</span>,
    },
    {
      key: 'stock',
      header: 'Estoque atual',
      render: (r) => (
        <span className={r.stock <= 0 ? 'font-semibold text-danger' : 'text-foreground'}>
          {formatNumber(r.stock)}
        </span>
      ),
    },
    {
      key: 'minStock',
      header: 'Mínimo',
      render: (r) => <span className="text-muted">{formatNumber(r.minStock)}</span>,
    },
    {
      key: 'deficit',
      header: 'Comprar (sugestão)',
      render: (r) => (
        <Chip variant="soft" color={r.stock <= 0 ? 'danger' : 'warning'} size="sm">
          +{formatNumber(r.deficit)}
        </Chip>
      ),
    },
  ];

  function exportCsv() {
    downloadCsv(
      'sugestao-compra-estoque',
      [
        { header: 'Produto', value: (r: InventorySuggestionItem) => r.name },
        { header: 'Estoque atual', value: (r) => String(r.stock) },
        { header: 'Mínimo', value: (r) => String(r.minStock) },
        { header: 'Sugestão de compra', value: (r) => String(r.deficit) },
      ],
      items,
    );
  }

  return (
    <div>
      <BackToReports />
      <PageHeader
        title="Estoque — Sugestão de compra"
        subtitle="Produtos com estoque igual ou abaixo do mínimo definido"
        actions={
          <Button variant="outline" onClick={exportCsv} isDisabled={items.length === 0}>
            <IconDownload size={16} /> Exportar CSV
          </Button>
        }
      />

      {query.isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* Alerta visual */}
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card
              className={
                items.length > 0
                  ? 'border border-warning/40 bg-warning/10 shadow-[var(--shadow-card)]'
                  : CARD
              }
            >
              <Card.Content className="flex items-center gap-3 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20 text-warning">
                  <IconBox size={20} />
                </span>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatNumber(items.length)}</p>
                  <p className="text-sm text-muted">produto(s) abaixo do mínimo</p>
                </div>
              </Card.Content>
            </Card>
            <Card
              className={
                zerados > 0
                  ? 'border border-danger/40 bg-danger/10 shadow-[var(--shadow-card)]'
                  : CARD
              }
            >
              <Card.Content className="flex items-center gap-3 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/15 text-danger">
                  <IconBox size={20} />
                </span>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatNumber(zerados)}</p>
                  <p className="text-sm text-muted">produto(s) sem estoque</p>
                </div>
              </Card.Content>
            </Card>
          </div>

          <Card className={CARD}>
            <Card.Content className="p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Lista de reposição</h3>
              {items.length === 0 ? (
                <EmptyState
                  title="Estoque em dia"
                  description="Nenhum produto com estoque abaixo do mínimo. Defina o estoque mínimo dos produtos para receber sugestões de compra."
                  icon={<IconBox size={28} />}
                />
              ) : (
                <DataTable
                  aria-label="Sugestão de compra"
                  columns={columns}
                  rows={items}
                  getKey={(r) => r.productId}
                />
              )}
            </Card.Content>
          </Card>
        </>
      )}
    </div>
  );
}
