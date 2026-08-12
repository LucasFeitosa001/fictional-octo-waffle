import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  ListBox,
  Popover,
  Select,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { useConfirm } from '../components/ConfirmDialog';
import { InlineSearch } from '../components/InlineSearch';
import { IconTip } from '../components/IconTip';
import { AnimatedCheckbox } from '../components/AnimatedCheckbox';
import { AnimatedSelectionCell } from '../components/AnimatedSelectionCell';
import { FilterCheckbox } from '../components/FilterCheckbox';
import { FilterAside } from '../components/FilterAside';
import { FullDrawer } from '../components/FullDrawer';
import { BulkActionsSheet } from '../components/BulkActionsSheet';
import { SwitchRow } from '../components/SwitchRow';
import {
  buildSelectActions,
  useSelectMode,
  type BulkAction,
} from '../hooks/useSelectMode';
import { EmptyState, ErrorState } from '../components/States';
import { TableSkeleton } from '../components/Skeletons';
import {
  IconArrowDown,
  IconArrowUp,
  IconCircleCheck,
  IconFilter,
  IconLayers,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
  IconSettings,
  IconTrash,
  IconTruck,
  IconX,
} from '../components/icons';
import { formatNumber } from '../lib/format';
import { useSetPageActions } from '../layout/PageActions';
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
  type Supplier,
} from '../lib/queries/catalogo';

type StatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZE = 20;

// ── Colunas ocultáveis (T7) ─────────────────────────────────────────
// Colunas de dados que o usuário pode mostrar/ocultar pelo gear. A
// coluna-título ("Nome") e a de ações NÃO entram aqui — são sempre fixas.
const TOGGLE_COLS = [
  { key: 'email', label: 'E-mail' },
  { key: 'phone2', label: 'Telefone' },
  { key: 'phone', label: 'Celular' },
  { key: 'cnpj', label: 'CNPJ' },
] as const;
type ColKey = (typeof TOGGLE_COLS)[number]['key'];

const COLS_STORAGE_KEY = 'sp-cols-fornecedores';

function readHiddenCols(): Set<string> {
  try {
    const raw = localStorage.getItem(COLS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? new Set(arr.filter((x): x is string => typeof x === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Visibilidade de colunas persistida em localStorage (chave `sp-cols-fornecedores`).
 * Guarda o conjunto de colunas OCULTAS; `isVisible` responde por coluna.
 */
function useColumnVisibility() {
  const [hidden, setHidden] = useState<Set<string>>(() => readHiddenCols());

  const toggle = (key: ColKey) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* localStorage indisponível — segue sem persistir. */
      }
      return next;
    });
  };

  const isVisible = (key: ColKey) => !hidden.has(key);
  const hiddenCount = TOGGLE_COLS.filter((c) => hidden.has(c.key)).length;

  return { toggle, isVisible, hiddenCount };
}

// UFs para o select de Estado (o Belasis usa um <select> nativo aqui).
const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

// ---------------------------------------------------------------------
// addressJson: o backend guarda um objeto livre. O Belasis expõe endereço
// completo (CEP, logradouro, número…) + um segundo telefone (Telefone/phone2).
// Lemos/gravamos essa forma preservando o legado `line` (string ou {line}).
// ---------------------------------------------------------------------
interface SupplierAddress {
  line?: string;
  phone2?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  estado?: string;
  cidade?: string;
}

function readAddress(addressJson: unknown): SupplierAddress {
  if (addressJson && typeof addressJson === 'object') return addressJson as SupplierAddress;
  if (typeof addressJson === 'string') return { line: addressJson };
  return {};
}

// ---------------------------------------------------------------------
// Máscaras BR (só-UI, sem lib). Aplicadas ao digitar; guardamos a string
// já formatada — o backend aceita texto livre nesses campos.
// ---------------------------------------------------------------------

/** Máscara progressiva de telefone/celular BR: (00) 0000-0000 / (00) 00000-0000. */
function maskPhoneBr(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Máscara de CEP BR: 00000-000. */
function maskCep(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

/**
 * Consulta o ViaCEP para um CEP de 8 dígitos. Retorna null em qualquer falha
 * (rede, CEP inexistente) — o chamador trata como erro silencioso.
 */
async function fetchViaCep(cepDigits: string, signal?: AbortSignal): Promise<ViaCepResponse | null> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}

export function FornecedoresPage() {
  const confirm = useConfirm();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // Campo de busca desktop: revelado pelo botão "Buscar" do header. Expande
  // INLINE na própria fileira de botões (largura 0 → ~240px) sem empurrar a
  // tabela. No mobile o comportamento antigo (bloco abaixo do header) é mantido.
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Visibilidade de colunas (gear — T7), persistida em localStorage.
  const cols = useColumnVisibility();
  // Estado da bottom-sheet de ações em lote.
  const [actionsOpen, setActionsOpen] = useState(false);

  const suppliers = useSuppliers(search || undefined);
  const remove = useDeleteSupplier();
  const serverRows = suppliers.data?.data ?? [];
  const total = suppliers.data?.total ?? 0;

  // A busca de texto é feita no servidor; status é filtrado no cliente sobre as
  // linhas já carregadas (não há parâmetro de status no backend).
  const rows = useMemo(() => {
    const filtered = serverRows.filter((s) => {
      if (status === 'active' && !s.active) return false;
      if (status === 'inactive' && s.active) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      return sortAsc ? cmp : -cmp;
    });
  }, [serverRows, status, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, status, sortAsc]);

  const activeFilterCount = status !== 'all' ? 1 : 0;
  const hasFilters = Boolean(search.trim()) || activeFilterCount > 0;

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function clearAll() {
    setSearchInput('');
    setSearch('');
    setStatus('all');
  }

  // Modo de seleção (Belasis): infra padrão (useSelectMode) sobre os ids
  // VISÍVEIS na página atual — tabela desktop e cards mobile renderizam `paged`.
  const ids = useMemo(() => paged.map((r) => r.id), [paged]);
  const sel = useSelectMode(ids);

  // Exclui de verdade os selecionados (mutateAsync em Promise.all no hook de
  // delete existente), após confirmação. Depois fecha a sheet e sai do modo.
  const bulkActions: BulkAction[] = [
    {
      key: 'delete',
      label: 'Excluir selecionados',
      danger: true,
      icon: <IconTrash size={18} />,
      disabled: remove.isPending,
      onClick: async () => {
        const ok = await confirm({
          title: 'Excluir fornecedores?',
          message: `Excluir ${sel.count} fornecedor(es) selecionado(s)? Essa ação não pode ser desfeita.`,
          confirmLabel: 'Excluir',
          danger: true,
        });
        if (!ok) return;
        try {
          await Promise.all([...sel.selected].map((id) => remove.mutateAsync(id)));
          setActionsOpen(false);
          sel.cancel();
        } catch (err) {
          setMessage(
            err instanceof ApiClientError
              ? err.message
              : 'Não foi possível excluir os fornecedores.',
          );
        }
      },
    },
  ];

  async function handleRemove(s: Supplier) {
    setMessage(null);
    const ok = await confirm({
      title: 'Excluir fornecedor?',
      message: `Remover o fornecedor "${s.name}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(s.id);
    } catch (err) {
      setMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível excluir o fornecedor.',
      );
    }
  }

  // Mobile: BottomNav = [Filtros, Selecionar, Novo]. Busca fica sempre no topo
  // (input), padrão Belasis. Em selectMode a barra vira [Cancelar · Selecionar
  // todos · Ações] via buildSelectActions.
  useSetPageActions(
    sel.selectMode
      ? buildSelectActions({
          onCancel: sel.cancel,
          onSelectAll: sel.selectAll,
          allSelected: sel.allSelected,
          bulkActions,
          onOpenActions: () => setActionsOpen(true),
          count: sel.count,
        })
      : [
          {
            key: 'filtros',
            label: 'Filtros',
            icon: <IconFilter size={22} />,
            onClick: () => setFilterOpen((v) => !v),
          },
          {
            key: 'selecionar',
            label: 'Selecionar',
            icon: <IconCircleCheck size={22} />,
            onClick: sel.enter,
            disabled: rows.length === 0,
          },
          {
            key: 'novo',
            label: 'Novo',
            icon: <IconPlus size={22} />,
            onClick: () => setCreateOpen(true),
          },
        ],
    [sel.selectMode, sel.allSelected, sel.count, rows.length],
  );

  return (
    <div className="pb-10">
      {/* Cabeçalho (T6): título + fileira compacta de botões (T2/T3). */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Fornecedores</h1>
        {/* Desktop: barra de ações inline. No mobile essas ações vivem na BottomNav. */}
        <div className="hidden flex-wrap items-center gap-1.5 md:flex">
          {/* Busca inline (componente único de toolbar — ver InlineSearch). */}
          <InlineSearch
            open={searchOpen}
            onOpenChange={setSearchOpen}
            value={searchInput}
            onValueChange={setSearchInput}
            onSubmit={applySearch}
            onClose={() => {
              setSearchInput('');
              setSearch('');
            }}
            placeholder="Buscar fornecedor"
          />
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`btn-ghost-hover hidden h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors md:inline-flex ${
              filterOpen || activeFilterCount > 0
                ? 'border-primary bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)] text-primary'
                : 'border-line bg-card text-ink hover:bg-canvas'
            }`}
          >
            <IconFilter size={16} />
            <span className="hidden sm:inline">Filtrar</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
          {/* Ações em massa (T3): SEMPRE visível no desktop, à esquerda de "Novo".
              Fora do modo seleção → ativa o selectMode (checkboxes nas linhas).
              Em seleção → mostra a contagem e abre a BulkActionsSheet; um X ao
              lado sai do modo. NÃO existe barra "N selecionados" acima da tabela. */}
          {sel.selectMode ? (
            <div className="hidden items-center md:inline-flex">
              <button
                type="button"
                onClick={() => (sel.count > 0 ? setActionsOpen(true) : sel.selectAll())}
                className={`btn-ghost-hover inline-flex h-9 items-center gap-1.5 rounded-l-lg border px-3 text-sm font-medium transition-colors ${
                  sel.count > 0
                    ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border-line bg-card text-ink hover:bg-canvas'
                }`}
              >
                <IconLayers size={16} />
                <span>{sel.count > 0 ? `Ações (${sel.count})` : 'Selecionar todos'}</span>
              </button>
              <button
                type="button"
                onClick={sel.cancel}
                aria-label="Sair do modo seleção"
                className="btn-ghost-hover inline-flex h-9 items-center justify-center rounded-r-lg border border-l-0 border-line bg-card px-2 text-muted-ink transition-colors hover:bg-canvas hover:text-ink"
              >
                <IconX size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={sel.enter}
              className="btn-ghost-hover hidden h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas md:inline-flex"
            >
              <IconLayers size={16} />
              <span>Ações</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-primary-hover hidden h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 md:inline-flex"
          >
            <IconPlus size={16} />
            <span>Novo</span>
          </button>
        </div>
      </header>

      {message && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {message}
        </div>
      )}

      {/* Barra de busca mobile — sempre visível no topo */}
      <div className="mb-3 md:hidden">
        <TextField
          value={searchInput}
          onChange={setSearchInput}
          aria-label="Buscar fornecedor"
        >
          <Input
            placeholder="Digite para buscar"
            className="focus:border-primary focus:ring-2 focus:ring-primary/25"
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            onBlur={applySearch}
          />
        </TextField>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Painel de filtros lateral (Filtrar) */}
        <FilterAside open={filterOpen} width="lg:w-72">
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

          <FilterGroup title="Status">
            <CheckRow checked={status === 'all'} onClick={() => setStatus('all')}>
              Todos
            </CheckRow>
            <CheckRow checked={status === 'active'} onClick={() => setStatus('active')}>
              Ativos
            </CheckRow>
            <CheckRow
              checked={status === 'inactive'}
              onClick={() => setStatus('inactive')}
            >
              Inativos
            </CheckRow>
          </FilterGroup>
        </FilterAside>

        {/* Conteúdo principal: tabela / cards */}
        <div className="min-w-0 flex-1">
          {suppliers.isLoading ? (
            <TableSkeleton columns={5} />
          ) : suppliers.isError ? (
            <ErrorState onRetry={() => suppliers.refetch()} />
          ) : rows.length === 0 ? (
            <>
              {/* Desktop: empty state em Card */}
              <div className="hidden rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)] md:block">
                <EmptyState
                  icon={<IconTruck size={32} />}
                  title={
                    hasFilters
                      ? 'Nenhum fornecedor encontrado'
                      : 'Nenhum fornecedor cadastrado'
                  }
                  description={
                    hasFilters
                      ? 'Ajuste a busca ou os filtros para ver mais resultados.'
                      : 'Cadastre seu primeiro fornecedor.'
                  }
                  action={
                    hasFilters ? (
                      <Button variant="outline" onClick={clearAll}>
                        Limpar filtros
                      </Button>
                    ) : (
                      <Button variant="primary" onClick={() => setCreateOpen(true)}>
                        <IconPlus size={16} /> Novo fornecedor
                      </Button>
                    )
                  }
                />
              </div>
              {/* Mobile: sem Card wrapper */}
              <div className="md:hidden">
                <EmptyState
                  icon={<IconTruck size={32} />}
                  title={
                    hasFilters
                      ? 'Nenhum fornecedor encontrado'
                      : 'Nenhum fornecedor cadastrado'
                  }
                  description={
                    hasFilters
                      ? 'Ajuste a busca ou os filtros para ver mais resultados.'
                      : 'Cadastre seu primeiro fornecedor.'
                  }
                  action={
                    hasFilters ? (
                      <Button variant="outline" onClick={clearAll}>
                        Limpar filtros
                      </Button>
                    ) : (
                      <Button variant="primary" onClick={() => setCreateOpen(true)}>
                        <IconPlus size={16} /> Novo fornecedor
                      </Button>
                    )
                  }
                />
              </div>
            </>
          ) : (
            <>
              {/* ===== Desktop: tabela ===== */}
              <div className="hidden overflow-clip rounded-xl border border-line bg-card shadow-[var(--shadow-card)] md:block">
                <table className="w-full border-collapse text-sm">
                  {/* T8: thead sticky no topo do scroll do <main>. Fundo sólido
                      (bg-card) + z-20 pra cobrir as linhas ao rolar. */}
                  <thead className="sticky top-0 z-20 bg-card">
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                      <AnimatedSelectionCell active={sel.selectMode} header className="px-4 py-3">
                        <Checkbox
                          isSelected={sel.allSelected}
                          onChange={() => sel.selectAll()}
                          aria-label="Selecionar todos"
                          className="shrink-0"
                        >
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
                      </AnimatedSelectionCell>
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => setSortAsc((v) => !v)}
                          className="inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-primary"
                          title="Ordenar por nome"
                        >
                          Nome
                          {sortAsc ? (
                            <IconArrowUp size={13} className="text-primary" />
                          ) : (
                            <IconArrowDown size={13} className="text-primary" />
                          )}
                        </button>
                      </th>
                      {cols.isVisible('email') && (
                        <th className="px-4 py-3 font-semibold">E-mail</th>
                      )}
                      {cols.isVisible('phone2') && (
                        <th className="px-4 py-3 font-semibold">Telefone</th>
                      )}
                      {cols.isVisible('phone') && (
                        <th className="px-4 py-3 font-semibold">Celular</th>
                      )}
                      {cols.isVisible('cnpj') && (
                        <th className="px-4 py-3 font-semibold">CNPJ</th>
                      )}
                      <th className="w-20 px-4 py-3 text-center">
                        {/* T7: gear abre Popover pra mostrar/ocultar colunas. */}
                        <Popover>
                          <Popover.Trigger>
                            <button
                              type="button"
                              aria-label="Configurar colunas"
                              className="btn-ghost-hover relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-ink transition-colors hover:bg-canvas hover:text-ink"
                            >
                              <IconSettings size={16} />
                              {cols.hiddenCount > 0 && (
                                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
                              )}
                            </button>
                          </Popover.Trigger>
                          <Popover.Content className="w-60">
                            <Popover.Dialog className="flex flex-col gap-1 p-1">
                              <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">
                                Colunas visíveis
                              </div>
                              <ul className="flex flex-col">
                                {TOGGLE_COLS.map((col) => (
                                  <li key={col.key}>
                                    <Checkbox
                                      isSelected={cols.isVisible(col.key)}
                                      onChange={() => cols.toggle(col.key)}
                                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-canvas"
                                    >
                                      <Checkbox.Content className="flex min-w-0 items-center gap-2">
                                        <Checkbox.Control>
                                          <Checkbox.Indicator />
                                        </Checkbox.Control>
                                        <span className="min-w-0 truncate">
                                          {col.label}
                                        </span>
                                      </Checkbox.Content>
                                    </Checkbox>
                                  </li>
                                ))}
                              </ul>
                            </Popover.Dialog>
                          </Popover.Content>
                        </Popover>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((s) => {
                      const addr = readAddress(s.addressJson);
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                        >
                          <AnimatedSelectionCell active={sel.selectMode} className="px-4 py-2.5">
                            <Checkbox
                              isSelected={sel.isSelected(s.id)}
                              onChange={() => sel.toggle(s.id)}
                              aria-label={`Selecionar ${s.name}`}
                              className="shrink-0"
                            >
                              <Checkbox.Content>
                                <Checkbox.Control>
                                  <Checkbox.Indicator />
                                </Checkbox.Control>
                              </Checkbox.Content>
                            </Checkbox>
                          </AnimatedSelectionCell>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setEditing(s)}
                              className="flex w-full items-center gap-2.5 text-left"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-primary">
                                <IconTruck size={16} />
                              </span>
                              <span className="min-w-0 truncate font-medium text-primary hover:underline">
                                {s.name}
                              </span>
                              {!s.active && (
                                <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--sp-ink)_8%,transparent)] px-2 py-0.5 text-[10px] font-medium text-muted-ink">
                                  Inativo
                                </span>
                              )}
                            </button>
                          </td>
                          {cols.isVisible('email') && (
                            <td className="px-4 py-2.5 text-muted-ink">{s.email || '—'}</td>
                          )}
                          {cols.isVisible('phone2') && (
                            <td className="px-4 py-2.5 text-muted-ink">{addr.phone2 || '—'}</td>
                          )}
                          {cols.isVisible('phone') && (
                            <td className="px-4 py-2.5 text-muted-ink">{s.phone || '—'}</td>
                          )}
                          {cols.isVisible('cnpj') && (
                            <td className="px-4 py-2.5 text-muted-ink">{s.cnpj || '—'}</td>
                          )}
                          <td className="px-4 py-2.5">
                            <RowActions
                              onEdit={() => setEditing(s)}
                              onDelete={() => handleRemove(s)}
                              deleting={remove.isPending}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ===== Mobile: cards ===== */}
              <ul className="flex flex-col gap-2 md:hidden">
                {paged.map((s) => {
                  const addr = readAddress(s.addressJson);
                  return (
                    <li
                      key={s.id}
                      className={[
                        'rounded-xl border bg-card p-3 shadow-[var(--shadow-card)] transition-colors',
                        sel.selectMode && sel.isSelected(s.id)
                          ? 'border-primary ring-1 ring-primary/40'
                          : 'border-line',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        onClick={() => (sel.selectMode ? sel.toggle(s.id) : setEditing(s))}
                        aria-pressed={sel.selectMode ? sel.isSelected(s.id) : undefined}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        {sel.selectMode && (
                          <AnimatedCheckbox checked={sel.isSelected(s.id)} />
                        )}
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-primary">
                          <IconTruck size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="min-w-0 truncate font-medium text-primary hover:underline">
                              {s.name}
                            </span>
                            {!s.active && (
                              <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--sp-ink)_8%,transparent)] px-2 py-0.5 text-[10px] font-medium text-muted-ink">
                                Inativo
                              </span>
                            )}
                          </span>
                          {s.email && (
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-ink">
                              <IconMail size={12} className="opacity-60" />
                              <span className="min-w-0 truncate">{s.email}</span>
                            </span>
                          )}
                          {(s.phone || addr.phone2) && (
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-ink">
                              <IconPhone size={12} className="opacity-60" />
                              {s.phone || addr.phone2}
                            </span>
                          )}
                          {s.cnpj && (
                            <span className="mt-0.5 block text-xs text-muted-ink/80">
                              CNPJ: {s.cnpj}
                            </span>
                          )}
                        </div>
                      </button>
                      {!sel.selectMode && (
                        <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-line/60 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Editar"
                            onClick={() => setEditing(s)}
                          >
                            <IconPencil size={14} /> Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Remover"
                            className="text-danger"
                            isDisabled={remove.isPending}
                            onClick={() => handleRemove(s)}
                          >
                            <IconTrash size={14} />
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Rodapé: contagem + paginação */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-ink">
                <span>
                  {hasFilters
                    ? `${formatNumber(rows.length)} de ${formatNumber(total)} fornecedor(es)`
                    : `${formatNumber(total)} no total`}
                </span>
                {pageCount > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drawers laterais (Novo / Editar) — deslizam da direita, igual Belasis */}
      <SupplierDrawer
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <SupplierDrawer
        mode="edit"
        supplier={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
      />

      {/* Ações em lote (Belasis): bottom-sheet aberto pelo "Ações" do selectMode. */}
      <BulkActionsSheet
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        actions={bulkActions}
        count={sel.count}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Subcomponentes de apresentação
// ---------------------------------------------------------------------

function RowActions({
  onEdit,
  onDelete,
  deleting,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-1 text-muted-ink">
      <IconTip label="Editar">
        <button
          type="button"
          aria-label="Editar"
          onClick={onEdit}
          className="rounded p-1 hover:bg-canvas hover:text-primary"
        >
          <IconPencil size={16} />
        </button>
      </IconTip>
      <span className="h-4 w-px bg-line" />
      <IconTip label="Excluir">
        <button
          type="button"
          aria-label="Remover"
          onClick={onDelete}
          disabled={deleting}
          className="rounded p-1 text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          <IconTrash size={16} />
        </button>
      </IconTip>
    </div>
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
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">
        {title}
      </p>
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
    <FilterCheckbox checked={checked} onToggle={onClick} className="px-1 py-1">
      {children}
    </FilterCheckbox>
  );
}

// ---------------------------------------------------------------------
// Drawer lateral de cadastro/edição de fornecedor (clone do Belasis)
// ---------------------------------------------------------------------

export function SupplierDrawer({
  mode,
  supplier,
  isOpen,
  onClose,
}: {
  mode: 'create' | 'edit';
  supplier?: Supplier | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); // Celular
  const [phone2, setPhone2] = useState(''); // Telefone
  const [stateRegistration, setStateRegistration] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [active, setActive] = useState(true);
  const [section, setSection] = useState<'cadastro' | 'contatos' | 'endereco' | 'config'>('cadastro');
  // Endereço
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ao digitar o CEP: aplica máscara e, ao completar 8 dígitos, consulta o
  // ViaCEP para preencher logradouro/bairro/cidade/estado automaticamente.
  function handleCepChange(value: string) {
    const masked = maskCep(value);
    setCep(masked);
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length !== 8) return;
    setCepLoading(true);
    void fetchViaCep(digits).then((data) => {
      setCepLoading(false);
      if (!data) return; // CEP inválido/inexistente → erro silencioso
      if (data.logradouro) setLogradouro(data.logradouro);
      if (data.bairro) setBairro(data.bairro);
      if (data.localidade) setCidade(data.localidade);
      if (data.uf) setEstado(data.uf);
    });
  }

  useEffect(() => {
    if (!isOpen) return;
    const addr = readAddress(supplier?.addressJson);
    setName(supplier?.name ?? '');
    setEmail(supplier?.email ?? '');
    setPhone(supplier?.phone ? maskPhoneBr(supplier.phone) : '');
    setPhone2(addr.phone2 ? maskPhoneBr(addr.phone2) : '');
    setStateRegistration(supplier?.stateRegistration ?? '');
    setCnpj(supplier?.cnpj ?? '');
    setActive(supplier?.active ?? true);
    setCep(addr.cep ? maskCep(addr.cep) : '');
    setLogradouro(addr.logradouro ?? addr.line ?? '');
    setNumero(addr.numero ?? '');
    setComplemento(addr.complemento ?? '');
    setBairro(addr.bairro ?? '');
    setEstado(addr.estado ?? '');
    setCidade(addr.cidade ?? '');
    setError(null);
    setSection('cadastro');
  }, [isOpen, supplier]);

  const pending = create.isPending || update.isPending;
  const canSave = name.trim().length >= 2 && !pending;

  async function handleSave() {
    setError(null);
    const addrEntries: SupplierAddress = {};
    if (phone2.trim()) addrEntries.phone2 = phone2.trim();
    if (cep.trim()) addrEntries.cep = cep.trim();
    if (logradouro.trim()) addrEntries.logradouro = logradouro.trim();
    if (numero.trim()) addrEntries.numero = numero.trim();
    if (complemento.trim()) addrEntries.complemento = complemento.trim();
    if (bairro.trim()) addrEntries.bairro = bairro.trim();
    if (estado.trim()) addrEntries.estado = estado.trim();
    if (cidade.trim()) addrEntries.cidade = cidade.trim();
    const addressJson = Object.keys(addrEntries).length ? addrEntries : undefined;

    const body = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      cnpj: cnpj.trim() || undefined,
      stateRegistration: stateRegistration.trim() || undefined,
      addressJson,
      active,
    };
    try {
      if (mode === 'edit' && supplier) {
        await update.mutateAsync({ id: supplier.id, body });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível salvar o fornecedor.',
      );
    }
  }

  const title =
    mode === 'edit'
      ? `Editando fornecedor${supplier?.name ? ` — ${supplier.name}` : ''}`
      : 'Novo fornecedor';

  return (
    <FullDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      // Sem `widthClass` de propósito: no FullDrawer essa prop é o que transforma
      // o painel numa faixa lateral no desktop (FullDrawer.tsx:195-196). Como este
      // é um drawer de cadastro (4 abas + form em 2 colunas), ele abre em tela cheia.
      sections={[
        { key: 'cadastro', label: 'Cadastro' },
        { key: 'contatos', label: 'Contatos' },
        { key: 'endereco', label: 'Endereço' },
        { key: 'config', label: 'Configurações' },
      ]}
      activeSection={section}
      onSectionChange={(k) => setSection(k as typeof section)}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" isDisabled={!canSave} onClick={handleSave}>
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* ============ CADASTRO ============ */}
        {section === 'cadastro' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" required>
              <TextField value={name} onChange={setName} aria-label="Nome">
                <Input
                  placeholder="Nome"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
            </Field>
            <Field label="Inscrição estadual">
              <TextField
                value={stateRegistration}
                onChange={setStateRegistration}
                aria-label="Inscrição estadual"
              >
                <Input
                  placeholder="Inscrição estadual"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
            </Field>
            <Field label="CNPJ">
              <TextField value={cnpj} onChange={setCnpj} aria-label="CNPJ">
                <Input
                  placeholder="00.000.000/0000-00"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
            </Field>
          </div>
        )}

        {/* ============ CONTATOS ============ */}
        {section === 'contatos' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="E-mail">
              <TextField value={email} onChange={setEmail} aria-label="E-mail">
                <Input
                  type="email"
                  placeholder="E-mail"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
            </Field>
            <Field label="Celular">
              <TextField
                value={phone}
                onChange={(v) => setPhone(maskPhoneBr(v))}
                aria-label="Celular"
              >
                <Input
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
            </Field>
            <Field label="Telefone">
              <TextField
                value={phone2}
                onChange={(v) => setPhone2(maskPhoneBr(v))}
                aria-label="Telefone"
              >
                <Input
                  inputMode="tel"
                  placeholder="(00) 0000-0000"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
            </Field>
          </div>
        )}

        {/* ============ ENDEREÇO ============ */}
        {section === 'endereco' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CEP">
              <TextField value={cep} onChange={handleCepChange} aria-label="CEP">
                <Input
                  inputMode="numeric"
                  placeholder="00000-000"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
              {cepLoading && (
                <span className="mt-1 text-xs text-muted-ink">Buscando endereço…</span>
              )}
            </Field>
            <Field label="Logradouro">
              <TextField value={logradouro} onChange={setLogradouro} aria-label="Logradouro">
                <Input
                  placeholder="Rua, Avenida, Travessa..."
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
            </Field>
            <Field label="Número">
              <TextField value={numero} onChange={setNumero} aria-label="Número">
                <Input
                  placeholder="Número"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
            </Field>
            <Field label="Complemento">
              <TextField value={complemento} onChange={setComplemento} aria-label="Complemento">
                <Input
                  placeholder="Complemento"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
            </Field>
            <Field label="Bairro">
              <TextField value={bairro} onChange={setBairro} aria-label="Bairro">
                <Input
                  placeholder="Bairro"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
            </Field>
            <Field label="Estado">
              <Select
                aria-label="Estado"
                selectedKey={estado || null}
                onSelectionChange={(k) => setEstado(k ? String(k) : '')}
              >
                <Select.Trigger>
                  <Select.Value>
                    {({ isPlaceholder, selectedText }) =>
                      isPlaceholder ? 'Estado' : selectedText
                    }
                  </Select.Value>
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {BR_STATES.map((uf) => (
                      <ListBox.Item key={uf} id={uf} textValue={uf}>
                        {uf}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </Field>
            <Field label="Cidade">
              <TextField value={cidade} onChange={setCidade} aria-label="Cidade">
                <Input
                  placeholder="Cidade"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
            </Field>
          </div>
        )}

        {/* ============ CONFIGURAÇÕES ============ */}
        {section === 'config' && (
          <SwitchRow
            className="rounded-md border border-line bg-canvas p-3"
            label="Ativo"
            description="Se ativo, aparecerá na listagem do sistema para compras, movimentações financeiras etc"
            checked={active}
            onChange={setActive}
          />
        )}

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </div>
    </FullDrawer>
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

