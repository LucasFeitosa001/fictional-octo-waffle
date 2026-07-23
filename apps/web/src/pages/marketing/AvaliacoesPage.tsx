import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Card, Chip, Switch } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/States';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { HelpTooltip } from '../../components/HelpTooltip';
import { AppTabs } from '../../components/AppTabs';
import {
  IconArrowDown,
  IconArrowUp,
  IconDownload,
  IconHome,
  IconMessage,
  IconPercent,
  IconSettings,
  IconStar,
} from '../../components/icons';
import { formatDate, isoDate } from '../../lib/format';
import { useSetPageActions } from '../../layout/PageActions';
import {
  useReviewSettings,
  useReviews,
  useReviewsDashboard,
  useUpdateReviewSettings,
  type ProfessionalRating,
  type ReviewRow,
  type ReviewSettings,
} from '../../lib/queries/marketing';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return { from: isoDate(from), to: isoDate(to) };
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function Stars({ rating, size = 15 }: { rating: number; size?: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <IconStar
          key={n}
          size={size}
          className={n <= rounded ? 'text-data-reviews' : 'text-default-200'}
        />
      ))}
    </span>
  );
}

type RatingFilter = 'all' | '5' | '4plus' | '3minus';

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
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

// ------------------------------------------------------------------ shared UI

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--sp-data-reviews-soft)] font-semibold text-data-reviews"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

/** Small delta pill: green up / red down / muted neutral. */
function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) {
    return <span className="text-xs text-muted-ink">—</span>;
  }
  const up = rounded > 0;
  const abs = Math.abs(rounded);
  const text = `${up ? '+' : '−'}${abs}${suffix}`;
  return (
    <span
      className={[
        'inline-flex items-center gap-0.5 text-xs font-medium',
        up ? 'text-emerald-600' : 'text-red-500',
      ].join(' ')}
    >
      {up ? <IconArrowUp size={12} /> : <IconArrowDown size={12} />}
      {text}
    </span>
  );
}

/**
 * Belasis metric tile: white rounded card, ~140px tall, icon anchored top-right,
 * big 26px value stacked over a muted label (`wb__sc-v9hleu-5`).
 */
function MetricCard({
  icon,
  value,
  label,
  footer,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex h-[140px] flex-col justify-center rounded-xl border border-line bg-warm-white p-3 shadow-[var(--shadow-card)]">
      <span className="absolute right-2.5 top-2.5">{icon}</span>
      <span className="text-[26px] font-bold leading-none text-ink">{value}</span>
      <span className="mt-1.5 text-sm text-muted-ink">{label}</span>
      {footer && <div className="mt-1.5">{footer}</div>}
    </div>
  );
}

// -------------------------------------------------------------------- Painel

function PainelTab({
  range,
  setRange,
}: {
  range: { from: string; to: string };
  setRange: (r: { from: string; to: string }) => void;
}) {
  const dash = useReviewsDashboard(range.from, range.to);
  const data = dash.data;

  return (
    <div className="flex flex-col gap-4">
      <Card className="border border-line bg-warm-white shadow-[var(--shadow-card)]">
        <Card.Content className="p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </Card.Content>
      </Card>

      {dash.isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* Métricas do seu estabelecimento */}
          <div className="flex flex-col">
            <h2 className="mb-2.5 text-base font-semibold text-ink">
              Métricas do seu estabelecimento
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                icon={<IconStar size={26} className="text-data-reviews" />}
                value={(data?.current.average ?? 0).toFixed(1)}
                label={
                  <span className="inline-flex items-center">
                    Média das avaliações
                    <HelpTooltip>Média das notas recebidas no período filtrado.</HelpTooltip>
                  </span>
                }
                footer={<Delta value={(data?.current.average ?? 0) - (data?.previous.average ?? 0)} />}
              />
              <MetricCard
                icon={<IconMessage size={26} className="text-data-reviews" />}
                value={data?.current.count ?? 0}
                label={
                  <span className="inline-flex items-center">
                    Quantidade de avaliações
                    <HelpTooltip>Total de avaliações recebidas no período.</HelpTooltip>
                  </span>
                }
                footer={<Delta value={(data?.current.count ?? 0) - (data?.previous.count ?? 0)} />}
              />
              <MetricCard
                icon={<IconPercent size={26} className="text-data-reviews" />}
                // TODO: Belasis usa response_rate; usamos commentRate (campo disponível).
                value={`${Math.round((data?.current.commentRate ?? 0) * 100)}%`}
                label={
                  <span className="inline-flex items-center">
                    Taxa de resposta
                    <HelpTooltip>Percentual de avaliações que vieram com comentário.</HelpTooltip>
                  </span>
                }
                footer={
                  <Delta
                    value={
                      Math.round((data?.current.commentRate ?? 0) * 100) -
                      Math.round((data?.previous.commentRate ?? 0) * 100)
                    }
                    suffix="%"
                  />
                }
              />
              <MetricCard
                icon={data?.best ? <Avatar name={data.best.name} size={32} /> : <IconStar size={26} className="text-data-reviews" />}
                value={data?.best ? data.best.rating.toFixed(1) : '0.0'}
                label={
                  <span className="inline-flex items-center">
                    {data?.best ? `Melhor avaliado(a) ${firstName(data.best.name)}` : 'Melhor avaliado(a)'}
                    <HelpTooltip>Profissional com a maior média no período.</HelpTooltip>
                  </span>
                }
              />
            </div>
          </div>

          {/* Médias dos profissionais — carrossel horizontal (wb__sc-1i8gh11) */}
          <div className="flex flex-col">
            <h2 className="mb-1 text-base font-semibold text-ink">Médias dos profissionais</h2>
            {data && data.professionals.length > 0 ? (
              <div className="flex gap-2.5 overflow-x-auto whitespace-nowrap pb-3.5 pt-2.5">
                {data.professionals.map((p: ProfessionalRating) => (
                  <div
                    key={p.id}
                    className="flex min-w-[110px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-card p-2.5 shadow-[var(--shadow-card)]"
                  >
                    <Avatar name={p.name} size={60} />
                    <span className="mt-1 w-[110px] truncate text-center text-sm text-ink">
                      {firstName(p.name)}
                    </span>
                    <div className="flex items-center gap-1">
                      <IconStar size={14} className="text-data-reviews" />
                      <span className="text-sm text-ink">{p.rating.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<IconStar size={32} />}
                title="Sem avaliações por profissional"
                description="Assim que houver avaliações no período, o ranking aparece aqui."
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Avaliações

function AvaliacoesTab({
  range,
  setRange,
}: {
  range: { from: string; to: string };
  setRange: (r: { from: string; to: string }) => void;
}) {
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

  // Mobile: expõe a ação da aba na BottomNav (mesmo handler do botão desktop).
  // Registrada aqui, dentro da aba, para reutilizar `exportCsv`/`rows` sem
  // içar estado; a limpeza no unmount devolve a BottomNav ao padrão.
  useSetPageActions(
    [
      {
        key: 'exportar',
        label: 'Exportar',
        icon: <IconDownload size={22} />,
        onClick: exportCsv,
        disabled: rows.length === 0,
      },
    ],
    [rows],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <Card className="border border-line bg-warm-white shadow-[var(--shadow-card)]">
        <Card.Content className="flex flex-col gap-3 p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center text-xs font-medium text-muted-ink">
                Nota
                <HelpTooltip>Filtre por faixa de nota recebida (1 a 5 estrelas).</HelpTooltip>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {RATING_OPTIONS.map(([key, label]) => {
                  const isActive = ratingFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRatingFilter(key)}
                      className={[
                        'min-h-10 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-data-reviews text-white shadow-[var(--shadow-card)]'
                          : 'text-muted-ink hover:bg-[var(--sp-data-reviews-soft)] hover:text-data-reviews',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button
              variant="outline"
              className="hidden md:inline-flex"
              onClick={exportCsv}
              isDisabled={rows.length === 0}
            >
              <IconDownload size={16} /> Exportar CSV
            </Button>
          </div>
        </Card.Content>
      </Card>

      {reviews.isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* Average summary */}
          <Card className="border border-line bg-warm-white shadow-[var(--shadow-card)]">
            <Card.Content className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold text-ink">
                  {(data?.average ?? 0).toFixed(1)}
                </div>
                <div>
                  <Stars rating={Math.round(data?.average ?? 0)} size={18} />
                  <p className="mt-1 text-sm text-muted-ink">
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
                    <div key={star} className="flex items-center gap-2 text-xs text-muted-ink">
                      <span className="w-3">{star}</span>
                      <IconStar size={12} className="text-data-reviews" />
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-default-100">
                        <div
                          className="h-full rounded-full bg-data-reviews"
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
                  className="border border-line bg-warm-white shadow-[var(--shadow-card)]"
                >
                  <Card.Content className="p-4">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar name={r.customer?.name ?? 'Cliente'} size={36} />
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {r.customer?.name ?? 'Cliente'}
                          </span>
                          <Stars rating={r.rating} />
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-ink">
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                    {r.comment && <p className="mt-2 text-sm text-ink">{r.comment}</p>}
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

// -------------------------------------------------------------- Configurações

function LabeledTextarea({
  label,
  hint,
  value,
  rows = 3,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  rows?: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      {hint && <span className="text-xs text-muted-ink">{hint}</span>}
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
      />
    </label>
  );
}

const EMPTY_SETTINGS: ReviewSettings = {
  moduleActive: true,
  headerTitle: '',
  headerText: '',
  successText: '',
  footerText: '',
  requestMessage: '',
};

function ConfiguracoesTab() {
  const settings = useReviewSettings();
  const update = useUpdateReviewSettings();
  const [form, setForm] = useState<ReviewSettings>(EMPTY_SETTINGS);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  function set<K extends keyof ReviewSettings>(key: K, value: ReviewSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFeedback(null);
    setError(null);
  }

  async function save() {
    setFeedback(null);
    setError(null);
    try {
      await update.mutateAsync(form);
      setFeedback('Configurações salvas.');
    } catch (e) {
      setError(
        e instanceof ApiClientError ? e.message : 'Não foi possível salvar as configurações.',
      );
    }
  }

  if (settings.isLoading) return <LoadingState />;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card className="border border-line bg-warm-white shadow-[var(--shadow-card)]">
        <Card.Content className="flex flex-col gap-5 p-4 sm:p-6">
          <Switch
            isSelected={form.moduleActive}
            onChange={(v: boolean) => set('moduleActive', v)}
            className="flex w-full items-center justify-between gap-3"
          >
            <span className="min-w-0 text-sm text-ink">
              <span className="inline-flex items-center">
                Solicitar avaliação
                <HelpTooltip>Ativa ou desativa o módulo de avaliações do estabelecimento.</HelpTooltip>
              </span>
              <span className="block text-xs text-muted-ink">
                Enviar pedido de avaliação aos clientes após o atendimento.
              </span>
            </span>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>

          <div className="flex flex-col gap-4 border-t border-line pt-4">
            <h3 className="inline-flex items-center text-sm font-semibold text-ink">
              Página de avaliação
              <HelpTooltip>Textos exibidos ao cliente na página onde ele deixa a avaliação.</HelpTooltip>
            </h3>
            <LabeledTextarea
              label="Título"
              value={form.headerTitle}
              rows={2}
              onChange={(v) => set('headerTitle', v)}
            />
            <LabeledTextarea
              label="Mensagem de abertura"
              value={form.headerText}
              onChange={(v) => set('headerText', v)}
            />
            <LabeledTextarea
              label="Mensagem de agradecimento"
              hint="Exibida após o cliente enviar a avaliação."
              value={form.successText}
              onChange={(v) => set('successText', v)}
            />
            <LabeledTextarea
              label="Rodapé"
              value={form.footerText}
              onChange={(v) => set('footerText', v)}
            />
          </div>

          <div className="flex flex-col gap-4 border-t border-line pt-4">
            <h3 className="inline-flex items-center text-sm font-semibold text-ink">
              Solicitação de avaliação
              <HelpTooltip>Mensagem enviada ao cliente com o link para avaliar o atendimento.</HelpTooltip>
            </h3>
            <LabeledTextarea
              label="Mensagem de solicitação"
              hint="Use %NOME% para o nome do cliente e %LINK% para o link da avaliação."
              value={form.requestMessage}
              onChange={(v) => set('requestMessage', v)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button variant="primary" onClick={save} isDisabled={update.isPending}>
              {update.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
            {feedback && <span className="text-sm text-emerald-600">{feedback}</span>}
            {error && <span className="text-sm text-red-500">{error}</span>}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------- Page

type TabId = 'painel' | 'avaliacoes' | 'config';

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'painel', label: 'Painel', icon: <IconHome size={16} /> },
  { id: 'avaliacoes', label: 'Avaliações', icon: <IconStar size={16} /> },
  { id: 'config', label: 'Configurações', icon: <IconSettings size={16} /> },
];

export function AvaliacoesPage() {
  const [range, setRange] = useState(defaultRange);
  const [tab, setTab] = useState<TabId>('painel');

  return (
    <div>
      <PageHeader title="Avaliações" subtitle="Notas e comentários dos clientes" />

      <AppTabs
        items={TABS}
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key as TabId)}
        ariaLabel="Áreas de avaliações"
        className="mb-4"
      />

      {tab === 'painel' && <PainelTab range={range} setRange={setRange} />}
      {tab === 'avaliacoes' && <AvaliacoesTab range={range} setRange={setRange} />}
      {tab === 'config' && <ConfiguracoesTab />}
    </div>
  );
}
