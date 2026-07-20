import { useEffect, useMemo, useState } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../components/Drawer';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import {
  IconDownload,
  IconFilter,
  IconLayers,
  IconPencil,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconTrash,
} from '../components/icons';
import { formatDate, formatMoney, formatNumber } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { useCustomers, useServices } from '../lib/queries';
import { useAutoCreate } from '../lib/useAutoCreate';
import { PacotePerfilModal } from './PacotePerfilModal';
import {
  useCustomerPackages,
  useDeleteCustomerPackage,
  usePackageTemplates,
  useSellPackage,
  type CustomerPackage,
  type PackageStatus,
} from '../lib/queries/pacotes';

const NONE = '';
const PAGE_SIZE = 20;

// Disponibilidade derivada (o Belasis mostra "Ativo" / "Vencido" na coluna).
function availability(p: CustomerPackage): 'active' | 'expired' | 'finished' {
  if (p.status === 'finished') return 'finished';
  if (p.isExpired || p.status === 'expired') return 'expired';
  return 'active';
}

const AVAIL_LABEL: Record<'active' | 'expired' | 'finished', string> = {
  active: 'Ativo',
  expired: 'Vencido',
  finished: 'Finalizado',
};

type AvailFilter = 'all' | PackageStatus;

export function PacotesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AvailFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  useAutoCreate(() => setCreateOpen(true));

  const sold = useCustomerPackages();
  const delSold = useDeleteCustomerPackage();

  const allRows = sold.data?.data ?? [];

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 86_400_000 : null;
    return allRows.filter((p) => {
      const st = availability(p);
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (term && !(p.customer?.name ?? '').toLowerCase().includes(term)) return false;
      const created = new Date(p.createdAt).getTime();
      if (from != null && created < from) return false;
      if (to != null && created >= to) return false;
      return true;
    });
  }, [allRows, statusFilter, search, dateFrom, dateTo]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateFrom, dateTo]);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const hasFilters = Boolean(search) || activeFilterCount > 0;

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function clearAll() {
    setSearchInput('');
    setSearch('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  }

  function exportCsv() {
    downloadCsv<CustomerPackage>(
      `pacotes-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Ticket', value: (p) => `#${p.number}` },
        { header: 'Data', value: (p) => formatDate(p.createdAt) },
        { header: 'Validade', value: (p) => (p.expiresAt ? formatDate(p.expiresAt) : '') },
        { header: 'Cliente', value: (p) => p.customer?.name ?? '' },
        { header: 'Disponibilidade', value: (p) => AVAIL_LABEL[availability(p)] },
        { header: 'Valor', value: (p) => Number(p.price).toFixed(2) },
      ],
      rows,
    );
  }

  async function handleDelete(p: CustomerPackage) {
    if (!window.confirm(`Excluir o pacote #${p.number}?`)) return;
    try {
      await delSold.mutateAsync(p.id);
    } catch {
      window.alert('Não foi possível excluir o pacote.');
    }
  }

  return (
    <div className="pb-10">
      {/* Cabeçalho: título + Buscar / Filtrar / Novo (igual Belasis) */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Pacotes</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton active={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
            <IconSearch size={16} /> Buscar
          </ToolbarButton>
          <ToolbarButton
            active={filterOpen || activeFilterCount > 0}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <IconFilter size={16} /> Filtrar
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </ToolbarButton>
          <ToolbarButton onClick={exportCsv} disabled={rows.length === 0}>
            <IconDownload size={16} /> Exportar
          </ToolbarButton>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Novo
          </Button>
        </div>
      </header>

      {/* Barra de busca (toggle) */}
      {searchOpen && (
        <div className="mb-4 flex max-w-xl items-center gap-2">
          <TextField
            value={searchInput}
            onChange={setSearchInput}
            className="min-w-0 flex-1"
            aria-label="Buscar cliente"
          >
            <Input
              placeholder="Busque por um cliente"
              className="focus:border-primary focus:ring-2 focus:ring-primary/25"
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            />
          </TextField>
          <Button variant="primary" onClick={applySearch}>
            Buscar
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Painel de filtros lateral (Filtrar) */}
        {filterOpen && (
          <aside className="w-full shrink-0 rounded-xl border border-line bg-card p-4 shadow-[var(--shadow-card)] lg:w-72">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Filtros</span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>

            <FilterGroup title="Disponibilidade">
              <CheckRow checked={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
                Todos
              </CheckRow>
              <CheckRow
                checked={statusFilter === 'active'}
                onClick={() => setStatusFilter('active')}
              >
                Disponível
              </CheckRow>
              <CheckRow
                checked={statusFilter === 'expired'}
                onClick={() => setStatusFilter('expired')}
              >
                Vencido
              </CheckRow>
              <CheckRow
                checked={statusFilter === 'finished'}
                onClick={() => setStatusFilter('finished')}
              >
                Finalizado
              </CheckRow>
            </FilterGroup>

            <FilterGroup title="Período">
              <label className="mb-1 block text-[11px] font-medium text-muted-ink">De</label>
              <TextField value={dateFrom} onChange={setDateFrom} aria-label="Data inicial">
                <Input type="date" />
              </TextField>
              <label className="mb-1 mt-2 block text-[11px] font-medium text-muted-ink">Até</label>
              <TextField value={dateTo} onChange={setDateTo} aria-label="Data final">
                <Input type="date" />
              </TextField>
            </FilterGroup>
            {/* TODO Belasis: filtros "Status de pagamento" e "Pagamento" (Bloqueado/Em aberto/
                Atrasado/Pago) e "Excluídos" não existem no modelo de dados atual. */}
          </aside>
        )}

        {/* Conteúdo principal */}
        <div className="min-w-0 flex-1">
          {sold.isLoading ? (
            <LoadingState />
          ) : sold.isError ? (
            <ErrorState onRetry={() => sold.refetch()} />
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)]">
              <EmptyState
                icon={<IconLayers size={32} />}
                title={
                  allRows.length === 0 ? 'Nenhum pacote vendido' : 'Nenhum pacote encontrado'
                }
                description={
                  hasFilters
                    ? 'Tente ajustar os filtros.'
                    : 'Venda um pacote a um cliente para acompanhar sessões e validade.'
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" onClick={clearAll}>
                      Limpar filtros
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setCreateOpen(true)}>
                      <IconPlus size={16} /> Novo
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
              {/* ===== Desktop: tabela (colunas idênticas ao Belasis) ===== */}
              <div className="hidden overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)] md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                      <th className="px-4 py-3 font-semibold">Ticket</th>
                      <th className="px-4 py-3 font-semibold">Data</th>
                      <th className="px-4 py-3 font-semibold">Validade</th>
                      <th className="px-4 py-3 font-semibold">Cliente</th>
                      <th className="px-4 py-3 font-semibold">Disponibilidade</th>
                      <th className="px-4 py-3 text-right font-semibold">Valor</th>
                      <th className="px-4 py-3 text-center font-semibold">Nota Fiscal</th>
                      <th className="px-4 py-3 text-center font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((p) => {
                      const av = availability(p);
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                        >
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setDetailId(p.id)}
                              className="font-semibold text-primary hover:underline"
                            >
                              #{p.number}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-muted-ink">{formatDate(p.createdAt)}</td>
                          <td className="px-4 py-2.5 text-muted-ink">
                            {p.expiresAt ? formatDate(p.expiresAt) : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setDetailId(p.id)}
                              className="min-w-0 truncate text-left font-medium text-ink hover:text-primary"
                            >
                              {p.customer?.name ?? '—'}
                            </button>
                          </td>
                          <td className="px-4 py-2.5">
                            <AvailBadge value={av} />
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-ink">
                            {formatMoney(p.price)}
                          </td>
                          <td className="px-4 py-2.5 text-center text-muted-ink/50">
                            {/* TODO Belasis: emissão de nota fiscal ainda não integrada */}
                            <IconReceipt size={16} className="mx-auto" />
                          </td>
                          <td className="px-4 py-2.5">
                            <RowActions
                              onDetail={() => setDetailId(p.id)}
                              onDelete={() => handleDelete(p)}
                              deleting={delSold.isPending}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ===== Mobile: cards ===== */}
              <div className="md:hidden">
                <p className="mb-2 text-xs text-muted-ink">
                  Ordenando por <span className="font-medium text-ink">Ticket</span>
                </p>
                <ul className="flex flex-col gap-2">
                  {paged.map((p) => {
                    const av = availability(p);
                    return (
                      <li
                        key={p.id}
                        className="rounded-xl border border-line bg-card p-3 shadow-[var(--shadow-card)]"
                      >
                        <button
                          type="button"
                          onClick={() => setDetailId(p.id)}
                          className="flex w-full flex-col gap-1 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-primary">#{p.number}</span>
                            <AvailBadge value={av} />
                          </div>
                          <span className="min-w-0 truncate font-medium text-ink">
                            {p.customer?.name ?? '—'}
                          </span>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-ink">{formatDate(p.createdAt)}</span>
                            <span className="font-semibold text-ink">{formatMoney(p.price)}</span>
                          </div>
                          {p.expiresAt && (
                            <span className="text-xs text-muted-ink">
                              Validade: {formatDate(p.expiresAt)}
                            </span>
                          )}
                        </button>
                        <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-line/60 pt-2">
                          <Button variant="outline" size="sm" onClick={() => setDetailId(p.id)}>
                            Detalhes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Excluir"
                            className="text-danger"
                            isDisabled={delSold.isPending}
                            onClick={() => handleDelete(p)}
                          >
                            <IconTrash size={14} /> Excluir
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Rodapé: exportar + total + paginação ("N no total" / "20 / página") */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-ink">
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 font-medium text-ink transition-colors hover:bg-canvas"
                >
                  <IconDownload size={14} /> Exportar CSV
                </button>
                <div className="flex items-center gap-3">
                  <span>{formatNumber(rows.length)} no total</span>
                  {pageCount > 1 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={safePage <= 1}
                        onClick={() => setPage((v) => Math.max(1, v - 1))}
                      >
                        Anterior
                      </Button>
                      <span className="px-1">
                        {safePage} / {pageCount}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={safePage >= pageCount}
                        onClick={() => setPage((v) => Math.min(pageCount, v + 1))}
                      >
                        Próxima
                      </Button>
                    </div>
                  )}
                  <span className="hidden sm:inline">{PAGE_SIZE} / página</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drawer lateral de novo pacote (desliza da direita) */}
      <NovoPacoteDrawer isOpen={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Detalhe / perfil do pacote */}
      <PacotePerfilModal
        packageId={detailId ?? undefined}
        isOpen={detailId !== null}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Subcomponentes de apresentação
// ---------------------------------------------------------------------

function AvailBadge({ value }: { value: 'active' | 'expired' | 'finished' }) {
  const styles: Record<typeof value, string> = {
    active:
      'bg-[color-mix(in_oklab,#2fc25b_14%,transparent)] text-[#1f8f45] border-[color-mix(in_oklab,#2fc25b_30%,transparent)]',
    expired:
      'bg-[color-mix(in_oklab,#ff4d4f_12%,transparent)] text-[#c62b2d] border-[color-mix(in_oklab,#ff4d4f_28%,transparent)]',
    finished: 'bg-canvas text-muted-ink border-line',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[value]}`}
    >
      {AVAIL_LABEL[value]}
    </span>
  );
}

function RowActions({
  onDetail,
  onDelete,
  deleting,
}: {
  onDetail: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-1 text-muted-ink">
      <button
        type="button"
        aria-label="Detalhes"
        title="Detalhes"
        onClick={onDetail}
        className="rounded p-1 hover:bg-canvas hover:text-primary"
      >
        <IconPencil size={16} />
      </button>
      <span className="h-4 w-px bg-line" />
      <button
        type="button"
        aria-label="Excluir"
        title="Excluir"
        onClick={onDelete}
        disabled={deleting}
        className="rounded p-1 text-danger hover:bg-danger/10 disabled:opacity-50"
      >
        <IconTrash size={16} />
      </button>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-primary bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)] text-primary'
          : 'border-line bg-card text-ink hover:bg-canvas',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">{title}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function CheckRow({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded px-1 py-1 text-left text-sm text-ink hover:bg-canvas"
    >
      <span
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-line bg-card',
        ].join(' ')}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6.5l2.5 2.5 4.5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------
// Drawer lateral: Novo pacote (clone do drawer do Belasis)
// ---------------------------------------------------------------------

function NovoPacoteDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const sell = useSellPackage();
  const customers = useCustomers('');
  const templates = usePackageTemplates();
  const services = useServices();

  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [price, setPrice] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [cashback, setCashback] = useState('');
  const [observation, setObservation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const customerList = useMemo(() => customers.data?.data ?? [], [customers.data]);
  const templateList = useMemo(() => templates.data ?? [], [templates.data]);
  const serviceMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services.data?.data ?? []) m.set(s.id, s.name);
    return m;
  }, [services.data]);

  const selectedTemplate = templateList.find((t) => t.id === templateId) ?? null;

  useEffect(() => {
    if (isOpen) {
      setCustomerId('');
      setDate('');
      setValidUntil('');
      setTemplateId('');
      setPrice('');
      setCreditNote('');
      setCashback('');
      setObservation('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedTemplate) setPrice(selectedTemplate.price);
  }, [selectedTemplate]);

  const canSave = customerId !== '' && templateId !== '' && !sell.isPending;

  async function handleSave() {
    setError(null);
    try {
      // Data / Validade / Vendedor / Crédito / Cashback / Observação são exibidos
      // fielmente ao Belasis, mas a API atual só aceita cliente + modelo + valor. // TODO
      await sell.mutateAsync({
        customerId,
        templateId,
        price: price !== '' ? Number(price) : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar o pacote.');
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Novo pacote"
      widthClass="sm:w-[620px]"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" isDisabled={!canSave} onClick={handleSave}>
            {sell.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Cliente" required>
          <Select
            aria-label="Cliente"
            selectedKey={customerId || null}
            onSelectionChange={(k) => setCustomerId(k ? String(k) : NONE)}
          >
            <Select.Trigger>
              <Select.Value>
                {({ isPlaceholder, selectedText }) =>
                  isPlaceholder ? 'Busque por um cliente' : selectedText
                }
              </Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {customerList.map((c) => (
                  <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                    {c.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Data">
            {/* TODO Belasis: data de emissão não é enviada pela API atual */}
            <TextField value={date} onChange={setDate} aria-label="Data">
              <Input type="date" />
            </TextField>
          </Field>
          <Field label="Validade">
            {/* TODO Belasis: validade manual não é enviada pela API atual */}
            <TextField value={validUntil} onChange={setValidUntil} aria-label="Validade">
              <Input type="date" />
            </TextField>
          </Field>
        </div>

        <Field label="Pacote Predefinido">
          <Select
            aria-label="Pacote Predefinido"
            selectedKey={templateId || null}
            onSelectionChange={(k) => setTemplateId(k ? String(k) : NONE)}
          >
            <Select.Trigger>
              <Select.Value>
                {({ isPlaceholder, selectedText }) =>
                  isPlaceholder ? 'Selecione um pacote predefinido' : selectedText
                }
              </Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {templateList.map((t) => (
                  <ListBox.Item key={t.id} id={t.id} textValue={t.name}>
                    {t.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </Field>

        <Field label="Vendedor">
          {/* TODO Belasis: seleção de vendedor não suportada pela API de venda atual */}
          <div className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-muted-ink">
            Selecione um vendedor
          </div>
        </Field>

        {/* Itens do pacote — prévia do modelo selecionado (Belasis: tabela de itens) */}
        <div className="rounded-lg border border-line">
          <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-ink">
            Itens do pacote
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted-ink">
                  <th className="px-3 py-2 font-semibold">Descrição</th>
                  <th className="px-3 py-2 text-center font-semibold">Qtde.</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor unitário</th>
                  <th className="px-3 py-2 text-right font-semibold">Desconto</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedTemplate && selectedTemplate.items.length > 0 ? (
                  selectedTemplate.items.map((it) => (
                    <tr key={it.id} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-2 text-ink">
                        {it.service?.name ?? serviceMap.get(it.serviceId) ?? 'Serviço'}
                      </td>
                      <td className="px-3 py-2 text-center text-muted-ink">{it.sessions}</td>
                      <td className="px-3 py-2 text-right text-muted-ink">R$ —</td>
                      <td className="px-3 py-2 text-right text-muted-ink">R$ —</td>
                      <td className="px-3 py-2 text-right text-muted-ink">R$ —</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-sm text-muted-ink">
                      Selecionar serviço
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Valor (R$)">
            <TextField value={price} onChange={setPrice} aria-label="Valor">
              <Input type="number" placeholder="0,00" />
            </TextField>
          </Field>
          <Field label="Crédito">
            {/* TODO Belasis: crédito não enviado pela API atual */}
            <TextField value={creditNote} onChange={setCreditNote} aria-label="Crédito">
              <Input type="number" placeholder="0,00" />
            </TextField>
          </Field>
          <Field label="Cashback">
            {/* TODO Belasis: cashback não enviado pela API atual */}
            <TextField value={cashback} onChange={setCashback} aria-label="Cashback">
              <Input type="number" placeholder="0,00" />
            </TextField>
          </Field>
        </div>

        <Field label="Observação">
          {/* TODO Belasis: observação não enviada pela API atual */}
          <TextField value={observation} onChange={setObservation} aria-label="Observação">
            <Input placeholder="Observação" />
          </TextField>
        </Field>

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </div>
    </Drawer>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-ink">
        {required && <span className="mr-0.5 text-danger">*</span>}
        {label}
      </label>
      {children}
    </div>
  );
}
