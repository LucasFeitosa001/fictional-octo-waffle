'use client';

import { useState } from 'react';
import { Card, Chip } from '@heroui/react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { IconStar } from '@/components/icons';
import { formatDate, isoDate } from '@/lib/format';
import { useReviews, type ReviewRow } from '@/lib/queries/marketing';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return { from: isoDate(from), to: isoDate(to) };
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <IconStar
          key={n}
          size={15}
          className={n <= rating ? 'text-foreground' : 'text-muted/40'}
        />
      ))}
    </span>
  );
}

export default function AvaliacoesPage() {
  const [range, setRange] = useState(defaultRange);
  const reviews = useReviews(range.from, range.to);
  const data = reviews.data;
  const rows: ReviewRow[] = data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Avaliações"
        subtitle="Notas e comentários dos clientes"
      />

      <Card className="db-card mb-4">
        <Card.Content className="p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </Card.Content>
      </Card>

      {reviews.isLoading ? (
        <LoadingState />
      ) : reviews.isError ? (
        <ErrorState onRetry={() => reviews.refetch()} />
      ) : (
        <>
          {/* Average rating header */}
          <Card className="db-card mb-4">
            <Card.Content className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold text-foreground">
                  {(data?.average ?? 0).toFixed(1)}
                </div>
                <div>
                  <Stars rating={Math.round(data?.average ?? 0)} />
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
                      <IconStar size={12} className="text-foreground" />
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-foreground"
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
            <EmptyState icon={<IconStar size={32} />} title="Nenhuma avaliação no período" />
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map((r) => (
                <Card key={r.id} className="db-card">
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
                        <Chip variant="soft" color="default" size="sm">
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
