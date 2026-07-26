import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { DateField } from '../../components/DateRangeFilter';
import { LoadingState } from '../../components/States';
import { IconChevron, IconDownload, IconFilter, IconStar } from '../../components/icons';
import { formatMoney, formatNumber, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useReportsOverview } from '../../lib/queries/relatorios';
import { useSetPageActions } from '../../layout/PageActions';
import { BackToReports, CARD } from './reportShared';

// ─────────────────────────────────────────────────────────────────────────────
// Clone fiel da página "RelatorioRanking" do Belasis (/reports/clients/rank).
// A tela do Belasis é um GERADOR de relatório: um card com filtros
// (Tipo de Venda / Período / Ordenar por) + botão "Gerar relatório". Não há
// ação de criar/editar, portanto NÃO existe drawer lateral aqui — é read-only.
// Data-wiring preservado: continuamos consumindo useReportsOverview (topServices
// / topProducts) e apenas reorganizamos a apresentação para bater com o Belasis.
// ─────────────────────────────────────────────────────────────────────────────

type SaleType = 'both' | 'services' | 'products';
type OrderBy = 'total' | 'count';

interface Filters {
  saleType: SaleType;
  from: string;
  to: string;
  orderBy: OrderBy;
}

function defaultFilters(): Filters {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { saleType: 'both', from: isoDate(from), to: isoDate(to), orderBy: 'total' };
}

const SALE_TYPES: { value: SaleType; label: string }[] = [
  { value: 'both', label: 'Ambos' },
  { value: 'services', label: 'Serviços' },
  { value: 'products', label: 'Produtos' },
];

const ORDER_OPTIONS: { value: OrderBy; label: string }[] = [
  { value: 'total', label: 'Valor gasto' },
  { value: 'count', label: 'Quantidade' },
];

/** Rótulo de campo estilo ant-form (vertical): texto escuro, peso normal. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm text-ink">{children}</span>;
}

/** Radio group "solid" do Belasis: pílulas conectadas, selecionada = primária. */
function SaleTypeToggle({
  value,
  onChange,
}: {
  value: SaleType;
  onChange: (v: SaleType) => void;
}) {
  return (
    <div className="inline-flex w-full overflow-hidden rounded-lg border border-line sm:w-auto">
      {SALE_TYPES.map((opt, i) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'h-10 flex-1 px-4 text-sm font-medium transition-colors sm:flex-none',
              i > 0 ? 'border-l border-line' : '',
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-ink hover:bg-canvas',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Select nativo estilizado para bater com o ant-select do Belasis. */
function OrderSelect({
  value,
  onChange,
}: {
  value: OrderBy;
  onChange: (v: OrderBy) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as OrderBy)}
        aria-label="Ordenar por"
        className="h-10 w-full appearance-none rounded-lg border border-line bg-card px-3 pr-9 text-sm text-ink shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-[color-mix(in_oklab,var(--sp-primary)_30%,transparent)]"
      >
        {ORDER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevron
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-ink"
      />
    </div>
  );
}

interface Row {
  id: string;
  name: string;
  tipo: string;
  count: number;
  total: number;
}

export function RankingPage() {
  // Filtro "pendente" (form) vs. "aplicado" (dispara a consulta ao Gerar).
  const [pending, setPending] = useState<Filters>(defaultFilters);
  const [applied, setApplied] = useState<Filters>(pending);

  const query = useReportsOverview(applied.from, applied.to);
  const d = query.data;

  const rows = useMemo<Row[]>(() => {
    const svc: Row[] = (d?.topServices ?? []).map((r) => ({
      id: `s-${r.id}`,
      name: r.name,
      tipo: 'Serviço',
      count: r.count,
      total: r.total,
    }));
    const prod: Row[] = (d?.topProducts ?? []).map((r) => ({
      id: `p-${r.id}`,
      name: r.name,
      tipo: 'Produto',
      count: r.count,
      total: r.total,
    }));
    let base: Row[] =
      applied.saleType === 'services'
        ? svc
        : applied.saleType === 'products'
          ? prod
          : [...svc, ...prod];
    base = [...base].sort((a, b) =>
      applied.orderBy === 'count' ? b.count - a.count : b.total - a.total,
    );
    return base;
  }, [d, applied.saleType, applied.orderBy]);

  const totals = useMemo(
    () => ({
      count: rows.reduce((s, r) => s + r.count, 0),
      total: rows.reduce((s, r) => s + r.total, 0),
    }),
    [rows],
  );

  const showTipo = applied.saleType === 'both';

  function handleGenerate() {
    setApplied(pending);
  }

  function handleExport() {
    const exportRows = rows.map((row, index) => ({ ...row, position: index + 1 }));
    downloadCsv(
      `ranking-${applied.from}-${applied.to}`,
      [
        { header: 'Posição', value: (row) => row.position },
        { header: 'Nome', value: (row) => row.name },
        { header: 'Tipo', value: (row) => row.tipo },
        { header: 'Quantidade', value: (row) => row.count },
        { header: 'Valor', value: (row) => row.total },
      ],
      exportRows,
    );
  }

  // Mobile: as ações do card (Gerar / Exportar) vivem na BottomNav (padrão
  // Belasis). No desktop os botões inline continuam visíveis (ver `hidden md:flex`).
  useSetPageActions(
    [
      {
        key: 'gerar',
        label: 'Gerar',
        icon: <IconFilter size={22} />,
        onClick: () => setApplied(pending),
      },
      {
        key: 'exportar',
        label: 'Exportar',
        icon: <IconDownload size={22} />,
        onClick: handleExport,
        disabled: rows.length === 0,
      },
    ],
    [pending, rows, applied],
  );

  return (
    <div>
      <BackToReports />
      <PageHeader
        title="Ranking"
        subtitle="Itens que mais venderam no período, por valor ou quantidade"
      />

      {/* Card de filtros (Belasis "box-shadow" form) */}
      <div className={`mb-4 rounded-2xl p-4 sm:p-5 ${CARD}`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Tipo de Venda</FieldLabel>
            <SaleTypeToggle
              value={pending.saleType}
              onChange={(saleType) => setPending((p) => ({ ...p, saleType }))}
            />
          </div>

          <div>
            <FieldLabel>Período</FieldLabel>
            <div className="flex flex-wrap items-end gap-3">
              <DateField
                label="Data inicial"
                value={pending.from}
                max={pending.to || undefined}
                onChange={(from) => setPending((p) => ({ ...p, from }))}
              />
              <DateField
                label="Data final"
                value={pending.to}
                min={pending.from || undefined}
                onChange={(to) => setPending((p) => ({ ...p, to }))}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Ordenar por</FieldLabel>
            <OrderSelect
              value={pending.orderBy}
              onChange={(orderBy) => setPending((p) => ({ ...p, orderBy }))}
            />
          </div>
        </div>

        {/* Ação: Gerar relatório + export (Belasis: botão primário + dropdown).
            Desktop-only: no mobile essas ações ficam na BottomNav (useSetPageActions). */}
        <div className="mt-4 hidden justify-end md:flex">
          <div className="inline-flex overflow-hidden rounded-lg">
            <button
              type="button"
              onClick={handleGenerate}
              className="h-10 bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-strong"
            >
              Gerar relatório
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={rows.length === 0}
              aria-label="Exportar"
              title="Exportar CSV"
              className="flex h-10 items-center border-l border-[color-mix(in_oklab,var(--sp-primary-fg)_25%,transparent)] bg-primary px-3 text-primary-foreground transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconDownload size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Resultado */}
      {query.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <div className={`rounded-2xl p-10 text-center ${CARD}`}>
          <IconStar size={28} className="mx-auto mb-2 text-muted-ink" />
          <p className="text-sm text-muted-ink">Nenhum item encontrado no período.</p>
        </div>
      ) : (
        <div className={`overflow-hidden rounded-2xl ${CARD}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs uppercase tracking-wide text-muted-ink">
                  <th className="w-14 px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  {showTipo && <th className="px-4 py-3 font-medium">Tipo</th>}
                  <th className="px-4 py-3 text-right font-medium">Qtd.</th>
                  <th className="px-4 py-3 text-right font-medium">Valor gasto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className="border-b border-line last:border-0 transition-colors hover:bg-canvas"
                  >
                    <td className="px-4 py-3">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                        style={{
                          background:
                            i === 0
                              ? '#fef3c7'
                              : i === 1
                                ? '#f1f5f9'
                                : i === 2
                                  ? '#ffedd5'
                                  : '#f8fafc',
                          color:
                            i === 0
                              ? '#92400e'
                              : i === 1
                                ? '#475569'
                                : i === 2
                                  ? '#9a3412'
                                  : '#64748b',
                        }}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                    {showTipo && (
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            r.tipo === 'Produto'
                              ? 'bg-[var(--sp-data-products-soft)] text-data-products'
                              : 'bg-[var(--sp-data-services-soft)] text-data-services'
                          }`}
                        >
                          {r.tipo}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-muted-ink">
                      {formatNumber(r.count)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">
                      {formatMoney(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-canvas font-semibold text-ink">
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3">Total</td>
                  {showTipo && <td className="px-4 py-3" />}
                  <td className="px-4 py-3 text-right">{formatNumber(totals.count)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
