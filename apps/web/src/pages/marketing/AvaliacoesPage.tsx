import { useMemo, useState } from 'react';
import { Button, Card, Chip } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/States';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { IconDownload, IconStar } from '../../components/icons';
import { formatDate, isoDate } from '../../lib/format';
import { useReviews, type ReviewRow } from '../../lib/queries/marketing';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return { from: isoDate(from), to: isoDate(to) };
}

function Stars({ rating, size = 15 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <IconStar
          key={n}
          size={size}
          className={n <= rating ? 'text-[#f2b33d]' : 'text-default-200'}
        />
      ))}
    </span>
  );
}

type RatingFilter = 'all' | '5' | '4plus' | '3minus';

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const RATING_OPTIONS: [RatingFilter, string][] = [
  ['all', 'Todas'],
  ['5', '5★'],
  ['4plus', '4★+'],
  ['3minus', '≤3★'],
];

export function AvaliacoesPage() {
  const [range, setRange] = useState(defaultRange);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const reviews = useReviews(range.from, range.to);
  const data = reviews.data;
  const allRows: ReviewRow[] = data?.data ?? [];

  const rows = useMemo(() => {
    return allRows.filter((r) => {
      if (ratingFilter === '5') return r.rating === 5;
      if (ratingFilter === '4plus') return r.rating >= 4;
      if (ratingFilter === '3minus') return r.rating <= 3;
      return true;
    });
  }, [allRows, ratingFilter]);

  function exportCsv() {
    const header = ['Data', 'Nota', 'Cliente', 'Profissional', 'Serviço', 'Comentário'];
    const body = rows.map((r) => [
      formatDate(r.createdAt),
      String(r.rating),
      r.customer?.name ?? 'Cliente',
      r.professional?.name ?? '',
      r.service?.name ?? '',
      r.comment ?? '',
    ]);
    downloadCsv('avaliacoes.csv', [header, ...body]);
  }

  return (
    <div>
      <PageHeader
        title="Avaliações"
        subtitle="Notas e comentários dos clientes"
        onRefresh={() => reviews.refetch()}
        isRefreshing={reviews.isFetching}
        actions={
          <Button
            variant="outline"
            onClick={exportCsv}
            isDisabled={rows.length === 0}
          >
            <IconDownload size={16} /> Exportar CSV
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-4 border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
        <Card.Content className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">Nota</span>
            <div className="flex gap-1.5">
              {RATING_OPTIONS.map(([key, label]) => {
                const isActive = ratingFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRatingFilter(key)}
                    className={[
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-[#f2b33d] text-[#111111] shadow-[var(--shadow-gold)]'
                        : 'text-[#6f6a63] hover:bg-[#f2b33d]/15 hover:text-[#a67c1e]',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </Card.Content>
      </Card>

      {reviews.isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* Average rating header */}
          <Card className="mb-4 border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
            <Card.Content className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold text-[#111111]">
                  {(data?.average ?? 0).toFixed(1)}
                </div>
                <div>
                  <Stars rating={Math.round(data?.average ?? 0)} size={18} />
                  <p className="mt-1 text-sm text-muted">
                    {data?.count ?? 0} avaliação(ões) no período
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const n = data?.distribution[String(star)] ?? 0;
                  const total = data?.count ?? 0;
                  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs text-muted">
                      <span className="w-3">{star}</span>
                      <IconStar size={12} className="text-[#f2b33d]" />
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-default-100">
                        <div
                          className="h-full rounded-full bg-[#f2b33d]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right">{n}</span>
                    </div>
                  );
                })}
              </div>
            </Card.Content>
          </Card>

          {/* Reviews list */}
          {rows.length === 0 ? (
            <EmptyState
              icon={<IconStar size={32} />}
              title={
                allRows.length === 0
                  ? 'Nenhuma avaliação no período'
                  : 'Nenhuma avaliação com esse filtro'
              }
              description={
                allRows.length === 0
                  ? 'Quando seus clientes avaliarem, os comentários aparecem aqui.'
                  : 'Ajuste o filtro de nota para ver mais resultados.'
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map((r) => (
                <Card
                  key={r.id}
                  className="border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]"
                >
                  <Card.Content className="p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Stars rating={r.rating} />
                        <span className="text-sm font-medium text-foreground">
                          {r.customer?.name ?? 'Cliente'}
                        </span>
                      </div>
                      <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                    </div>
                    {r.comment && <p className="text-sm text-foreground">{r.comment}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.professional && (
                        <Chip variant="soft" color="accent" size="sm">
                          {r.professional.name}
                        </Chip>
                      )}
                      {r.service && (
                        <Chip variant="soft" color="default" size="sm">
                          {r.service.name}
                        </Chip>
                      )}
                    </div>
                  </Card.Content>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
