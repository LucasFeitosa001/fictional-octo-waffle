import { useEffect, useMemo, useState } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../../components/Drawer';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { DateField } from '../../components/DateRangeFilter';
import {
  IconChevron,
  IconDownload,
  IconFilter,
  IconMegaphone,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '../../components/icons';
import { formatDate, formatMoney } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useAutoCreate } from '../../lib/useAutoCreate';
import {
  useCreatePromotion,
  useDeletePromotion,
  usePromotions,
  useUpdatePromotion,
  type CreatePromotionBody,
  type DiscountType,
  type Promotion,
} from '../../lib/queries/marketing';

const PAGE_SIZE = 20;

// color-mix helper para superfícies temáticas derivadas de --sp-primary (100% themeable).
const primaryTint = (pct: number) =>
  `color-mix(in oklab, var(--sp-primary) ${pct}%, transparent)`;

type OnlineFilter = 'all' | 'online' | 'offline';

function discountLabel(p: Promotion) {
  return p.discountType === 'percent'
    ? `${Number(p.discountValue).toFixed(0)}%`
    : formatMoney(p.discountValue);
}

function validityLabel(p: Promotion) {
  return p.validFrom || p.validTo
    ? `${formatDate(p.validFrom)} → ${formatDate(p.validTo)}`
    : 'Sem prazo';
}

export function PromocoesPage() {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [onlineFilter, setOnlineFilter] = useState<OnlineFilter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  useAutoCreate(() => setCreateOpen(true));

  const promotions = usePromotions();
  const del = useDeletePromotion();

  const allRows = promotions.data ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (onlineFilter === 'online' && !p.appliesOnline) return false;
      if (onlineFilter === 'offline' && p.appliesOnline) return false;
      return true;
    });
  }, [allRows, search, onlineFilter]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = Boolean(search || onlineFilter !== 'all');

  function resetFilters() {
    setSearch('');
    setOnlineFilter('all');
    setPage(1);
  }

  async function handleDelete(p: Promotion) {
    if (!window.confirm(`Excluir a promoção "${p.name}"?`)) return;
    try {
      await del.mutateAsync(p.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    } catch {
      window.alert('Não foi possível excluir a promoção.');
    }
  }

  async function handleBulkDelete() {
    const ids = pageRows.filter((p) => selected.has(p.id)).map((p) => p.id);
    if (!ids.length) return;
    if (!window.confirm(`Excluir ${ids.length} promoção(ões) selecionada(s)?`)) return;
    for (const id of ids) await del.mutateAsync(id);
    setSelected(new Set());
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const pageIds = pageRows.map((p) => p.id);
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }
  const selectedCount = pageIds.filter((id) => selected.has(id)).length;

  function exportCsv() {
    downloadCsv<Promotion>(
      'promocoes',
      [
        { header: 'Promoção', value: (p) => p.name },
        { header: 'Desconto', value: (p) => discountLabel(p) },
        { header: 'Válido de', value: (p) => formatDate(p.validFrom) },
        { header: 'Válido até', value: (p) => formatDate(p.validTo) },
        { header: 'Limite de uso', value: (p) => (p.usageLimit ? p.usageLimit : 'Ilimitado') },
        { header: 'Online', value: (p) => (p.appliesOnline ? 'Sim' : 'Não') },
      ],
      rows,
    );
  }

  return (
    <div className="pb-6">
      {/* ── Cabeçalho / toolbar (título + Buscar / Filtrar / Exportar / Criar) ── */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">Promoções</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton
            active={showSearch}
            onClick={() => setShowSearch((v) => !v)}
            icon={<IconSearch size={16} />}
            label="Buscar"
          />
          <ToolbarButton
            active={showFilters}
            onClick={() => setShowFilters((v) => !v)}
            icon={<IconFilter size={16} />}
            label="Filtrar"
          />
          <Button variant="outline" size="sm" onClick={exportCsv} isDisabled={rows.length === 0}>
            <IconDownload size={16} /> Exportar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Criar
          </Button>
        </div>
      </header>

      {/* ── Campo de busca (revelado pelo botão Buscar) ── */}
      {showSearch && (
        <div className="mb-4">
          <TextField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            className="w-full max-w-sm"
            aria-label="Buscar promoção"
          >
            <Input
              placeholder="Digite para buscar…"
              className="focus:border-gold focus:ring-2 focus:ring-gold/25"
            />
          </TextField>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* ── Rail de filtros (Aplicação) ── */}
        {showFilters && (
          <aside className="w-full shrink-0 rounded-2xl border border-line bg-card p-4 lg:w-60">
            <FilterGroup title="Aplicação">
              <CheckRow
                label="Todas"
                checked={onlineFilter === 'all'}
                onChange={() => {
                  setOnlineFilter('all');
                  setPage(1);
                }}
              />
              <CheckRow
                label="Online"
                checked={onlineFilter === 'online'}
                onChange={() => {
                  setOnlineFilter('online');
                  setPage(1);
                }}
              />
              <CheckRow
                label="Presencial"
                checked={onlineFilter === 'offline'}
                onChange={() => {
                  setOnlineFilter('offline');
                  setPage(1);
                }}
              />
            </FilterGroup>

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 text-xs font-medium text-gold hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </aside>
        )}

        {/* ── Conteúdo (tabela desktop / cards mobile + paginação) ── */}
        <div className="min-w-0 flex-1">
          {selectedCount > 0 && (
            <div
              className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm text-foreground"
              style={{ background: primaryTint(8) }}
            >
              <span>{selectedCount} selecionada(s)</span>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={del.isPending}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-danger hover:underline disabled:opacity-50"
              >
                <IconTrash size={14} /> Excluir
              </button>
            </div>
          )}

          {promotions.isLoading ? (
            <LoadingState />
          ) : promotions.isError ? (
            <ErrorState onRetry={() => promotions.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconMegaphone size={32} />}
              title={hasFilters ? 'Nenhum item encontrado' : 'Nenhuma promoção cadastrada'}
              description={
                hasFilters
                  ? 'Verifique seus filtros e tente novamente.'
                  : 'Crie promoções com desconto, validade e limite de uso.'
              }
              action={
                hasFilters ? undefined : (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <IconPlus size={16} /> Clique para criar
                  </Button>
                )
              }
            />
          ) : (
            <>
              {/* Desktop: tabela antd-like */}
              <div className="hidden overflow-hidden rounded-2xl border border-line bg-card sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                      <th className="w-10 px-3 py-3">
                        <Check checked={allChecked} onChange={toggleSelectAll} />
                      </th>
                      <th className="px-3 py-3 font-semibold">Promoção</th>
                      <th className="px-3 py-3 font-semibold">Desconto</th>
                      <th className="px-3 py-3 font-semibold">Validade</th>
                      <th className="px-3 py-3 font-semibold">Limite de uso</th>
                      <th className="px-3 py-3 font-semibold">Online</th>
                      <th className="w-24 px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-line last:border-0 transition-colors hover:bg-canvas"
                      >
                        <td className="px-3 py-2.5">
                          <Check
                            checked={selected.has(p.id)}
                            onChange={() => toggleSelected(p.id)}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => setEditing(p)}
                            className="truncate text-left font-medium text-foreground hover:text-gold"
                          >
                            {p.name}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-gold-strong"
                            style={{ background: primaryTint(12) }}
                          >
                            {discountLabel(p)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-ink">
                          {validityLabel(p)}
                        </td>
                        <td className="px-3 py-2.5 text-foreground">
                          {p.usageLimit ? p.usageLimit : 'Ilimitado'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              p.appliesOnline
                                ? 'bg-success/15 text-success'
                                : 'bg-canvas text-muted-ink ring-1 ring-line'
                            }`}
                          >
                            {p.appliesOnline ? 'Sim' : 'Não'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <RowActions
                            onEdit={() => setEditing(p)}
                            onDelete={() => handleDelete(p)}
                            deleteDisabled={del.isPending}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards */}
              <ul className="flex flex-col gap-2 sm:hidden">
                {pageRows.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
                  >
                    <Check checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} />
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-foreground">{p.name}</span>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-gold-strong"
                          style={{ background: primaryTint(12) }}
                        >
                          {discountLabel(p)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-sm text-muted-ink">
                        <span className="truncate">{validityLabel(p)}</span>
                        <span>{p.appliesOnline ? 'Online' : 'Presencial'}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              <Pagination total={rows.length} page={page} pageCount={pageCount} onPage={setPage} />
            </>
          )}
        </div>
      </div>

      <PromocaoDrawer mode="create" isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <PromocaoDrawer
        mode="edit"
        promotion={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

/* ───────────────────────── UI building blocks ───────────────────────── */

function ToolbarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-gold text-gold' : 'border-line text-muted-ink hover:text-foreground'
      }`}
      style={active ? { background: primaryTint(10) } : undefined}
    >
      {icon} {label}
    </button>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-ink">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <Check checked={checked} onChange={onChange} />
      <span className="truncate">{label}</span>
    </label>
  );
}

function Check({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-line"
      style={{ accentColor: 'var(--sp-primary)' }}
    />
  );
}

function RowActions({
  onEdit,
  onDelete,
  deleteDisabled,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1 text-muted-ink">
      <button
        type="button"
        aria-label="Editar"
        onClick={onEdit}
        className="rounded p-1 transition-colors hover:text-gold"
      >
        <IconPencil size={16} />
      </button>
      <span className="h-4 w-px bg-line" aria-hidden />
      <button
        type="button"
        aria-label="Excluir"
        onClick={onDelete}
        disabled={deleteDisabled}
        className="rounded p-1 text-danger transition-colors hover:opacity-80 disabled:opacity-50"
      >
        <IconTrash size={16} />
      </button>
    </div>
  );
}

function Pagination({
  total,
  page,
  pageCount,
  onPage,
}: {
  total: number;
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  const pages: number[] = [];
  const from = Math.max(1, Math.min(page - 2, pageCount - 4));
  const to = Math.min(pageCount, from + 4);
  for (let i = from; i <= to; i++) pages.push(i);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-sm text-muted-ink">
      <span className="mr-auto">{total} registros no total</span>
      <button
        type="button"
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="Página anterior"
        className="grid h-8 w-8 place-items-center rounded-lg border border-line disabled:opacity-40"
      >
        <IconChevron size={16} className="rotate-90" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPage(p)}
          className={`h-8 min-w-8 rounded-lg border px-2 font-medium transition-colors ${
            p === page ? 'border-gold text-gold' : 'border-line hover:text-foreground'
          }`}
          style={p === page ? { background: primaryTint(10) } : undefined}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPage(Math.min(pageCount, page + 1))}
        disabled={page >= pageCount}
        aria-label="Próxima página"
        className="grid h-8 w-8 place-items-center rounded-lg border border-line disabled:opacity-40"
      >
        <IconChevron size={16} className="-rotate-90" />
      </button>
      <span className="ml-1">{PAGE_SIZE} / página</span>
    </div>
  );
}

/* ───────────────────────── Drawer lateral (Criar / Editar) ───────────────────────── */

function PromocaoDrawer({
  mode,
  promotion,
  isOpen,
  onClose,
}: {
  mode: 'create' | 'edit';
  promotion?: Promotion | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreatePromotion();
  const update = useUpdatePromotion();

  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [appliesOnline, setAppliesOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(promotion?.name ?? '');
    setDiscountType(promotion?.discountType ?? 'percent');
    setDiscountValue(promotion ? String(promotion.discountValue) : '');
    setValidFrom(promotion?.validFrom ? promotion.validFrom.slice(0, 10) : '');
    setValidTo(promotion?.validTo ? promotion.validTo.slice(0, 10) : '');
    setUsageLimit(promotion?.usageLimit != null ? String(promotion.usageLimit) : '');
    setAppliesOnline(promotion?.appliesOnline ?? false);
    setError(null);
  }, [isOpen, promotion]);

  const pending = create.isPending || update.isPending;
  const canSave =
    name.trim().length >= 2 && Number(discountValue.replace(',', '.')) > 0 && !pending;

  async function handleSave() {
    setError(null);
    const body: CreatePromotionBody = {
      name: name.trim(),
      scopeType: 'all',
      discountType,
      discountValue: Number(discountValue.replace(',', '.')),
      validFrom: validFrom || undefined,
      validTo: validTo || undefined,
      usageLimit: usageLimit ? Number(usageLimit) : undefined,
      appliesOnline,
    };
    try {
      if (mode === 'edit' && promotion) {
        await update.mutateAsync({ id: promotion.id, body });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a promoção.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar promoção' : 'Nova promoção'}
      footer={
        <>
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            isDisabled={!canSave}
            onClick={handleSave}
          >
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nome">
          <TextField value={name} onChange={setName} aria-label="Nome">
            <Input placeholder="Ex.: Black Friday" />
          </TextField>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo de desconto">
            <Select
              aria-label="Tipo de desconto"
              selectedKey={discountType}
              onSelectionChange={(k) => setDiscountType(String(k) as DiscountType)}
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="percent" textValue="Percentual">
                    Percentual (%)
                  </ListBox.Item>
                  <ListBox.Item id="value" textValue="Valor">
                    Valor (R$)
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </Field>
          <Field label={`Desconto ${discountType === 'percent' ? '(%)' : '(R$)'}`}>
            <TextField value={discountValue} onChange={setDiscountValue} aria-label="Desconto">
              <Input placeholder="0" inputMode="decimal" />
            </TextField>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DateField
            label="Válido de"
            value={validFrom}
            max={validTo || undefined}
            onChange={setValidFrom}
            className="min-w-0"
          />
          <DateField
            label="Válido até"
            value={validTo}
            min={validFrom || undefined}
            onChange={setValidTo}
            className="min-w-0"
          />
        </div>

        <Field label="Limite de uso">
          <TextField value={usageLimit} onChange={setUsageLimit} aria-label="Limite de uso">
            <Input placeholder="Ilimitado" inputMode="numeric" />
          </TextField>
        </Field>

        <Toggle
          label="Aplica no agendamento online"
          checked={appliesOnline}
          onChange={setAppliesOnline}
        />

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </div>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-ink">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <Check checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
