import { useMemo, useState } from 'react';
import { Avatar, Checkbox, Popover } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { DatePicker } from '../components/DatePicker';
import { EmptyState, ErrorState } from '../components/States';
import { TableSkeleton } from '../components/Skeletons';
import {
  IconChevron,
  IconCircleCheck,
  IconFilter,
  IconLayers,
  IconPencil,
  IconPlay,
  IconPlus,
  IconSearch,
  IconSettings,
  IconStar,
  IconTrash,
  IconUsers,
  IconX,
} from '../components/icons';
import { HelpTooltip } from '../components/HelpTooltip';
import { InlineSearch } from '../components/InlineSearch';
import { IconTip } from '../components/IconTip';
import { AnimatedCheckbox } from '../components/AnimatedCheckbox';
import { AnimatedSelectionCell } from '../components/AnimatedSelectionCell';
import { FilterCheckbox } from '../components/FilterCheckbox';
import { FilterAside } from '../components/FilterAside';
import { BulkActionsSheet } from '../components/BulkActionsSheet';
import { useSelectMode, buildSelectActions, type BulkAction } from '../hooks/useSelectMode';
import { useCustomers } from '../lib/queries';
import { useDeleteCustomer } from '../lib/queries/clientes';
import { formatDate, formatPhone, initials } from '../lib/format';
import type { CustomerFull } from '../lib/types';
import { useAutoCreate } from '../lib/useAutoCreate';
import { useSetPageActions } from '../layout/PageActions';
import { ClientePerfilModal, CustomerCreateModal } from './ClientePerfilTabs';
import { useConfirm } from '../components/ConfirmDialog';

// `YYYY-MM-DD` → `MMDD` para comparar aniversário ignorando o ano.
function monthDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = iso.slice(5, 10).replace('-', '');
  return s.length === 4 ? s : null;
}

// ── Colunas ocultáveis (T7) ─────────────────────────────────────────
// Colunas de dados que o usuário pode mostrar/ocultar pelo gear. A
// coluna-título ("Nome") e a de ações NÃO entram aqui — são sempre fixas.
const TOGGLE_COLS = [
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Celular' },
  { key: 'birthday', label: 'Nascimento' },
  { key: 'credits', label: 'Créditos' },
  { key: 'notes', label: 'Observações' },
] as const;
type ColKey = (typeof TOGGLE_COLS)[number]['key'];

const COLS_STORAGE_KEY = 'sp-cols-clientes';

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
 * Visibilidade de colunas persistida em localStorage (chave `sp-cols-clientes`).
 * Guarda o conjunto de colunas OCULTAS; `isVisible` responde por coluna.
 * Espelha o padrão do `DataTable` (readHidden/writeHidden) pra manter consistência.
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

export function ClientesPage() {
  // Busca
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // Campo de busca desktop: revelado pelo botão "Buscar" do header. Ele expande
  // INLINE na própria fileira de botões (largura 0 → ~240px) sem empurrar a
  // tabela. No mobile o comportamento antigo (bloco abaixo do header) é mantido.
  const [searchOpen, setSearchOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Visibilidade de colunas (gear — T7), persistida em localStorage.
  const cols = useColumnVisibility();

  // Painel de filtros (lado esquerdo no desktop, colapsável — botão "Filtrar")
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusAtivos, setStatusAtivos] = useState(true);
  const [statusInativos, setStatusInativos] = useState(false);
  const [comCelular, setComCelular] = useState(false);
  const [semCelular, setSemCelular] = useState(false);
  const [comDebito, setComDebito] = useState(false); // TODO: sem campo de débito no cliente
  const [semDebito, setSemDebito] = useState(false); // TODO
  const [tagQuery, setTagQuery] = useState('');
  const [birthdayStart, setBirthdayStart] = useState(''); // YYYY-MM-DD
  const [birthdayEnd, setBirthdayEnd] = useState('');

  // Modo de seleção (Belasis): infra padrão (useSelectMode) — os ids/allSelected
  // vêm das linhas visíveis (`rows`), montado logo abaixo. Estado da bottom-sheet
  // de ações em lote.
  const [actionsOpen, setActionsOpen] = useState(false);

  // "Vá até página" (input de salto do rodapé, igual ao Belasis)
  const [gotoInput, setGotoInput] = useState('');

  // Ordenação por nome — pílula "Ordenando por Nome" do mobile (Belasis).
  // Reordena, client-side, as linhas já carregadas; chevron ↑ = ascendente.
  const [sortAsc, setSortAsc] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [perfil, setPerfil] = useState<CustomerFull | null>(null);
  useAutoCreate(() => setCreateOpen(true));
  const confirm = useConfirm();

  const customers = useCustomers(search, page, pageSize);
  const remove = useDeleteCustomer();
  const data = customers.data;
  const allRows = (data?.data ?? []) as CustomerFull[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Filtros aplicados client-side sobre a página atual (a API só filtra por busca).
  const rows = useMemo(() => {
    const start = monthDay(birthdayStart);
    const end = monthDay(birthdayEnd);
    const tag = tagQuery.trim().toLowerCase();
    const filtered = allRows.filter((c) => {
      // Status
      if (statusAtivos || statusInativos) {
        if (statusAtivos && !statusInativos && !c.active) return false;
        if (statusInativos && !statusAtivos && c.active) return false;
      }
      // Celular
      if (comCelular && !semCelular && !c.phone) return false;
      if (semCelular && !comCelular && c.phone) return false;
      // Tags
      if (tag && !(c.tags ?? []).some((t) => t.name.toLowerCase().includes(tag)))
        return false;
      // Aniversário (intervalo por mês/dia)
      if (start || end) {
        const md = monthDay(c.birthday);
        if (!md) return false;
        if (start && end) {
          if (start <= end ? md < start || md > end : md < start && md > end)
            return false;
        } else if (start && md < start) return false;
        else if (end && md > end) return false;
      }
      return true;
    });
    return filtered.sort((a, b) =>
      sortAsc
        ? a.name.localeCompare(b.name, 'pt-BR')
        : b.name.localeCompare(a.name, 'pt-BR'),
    );
  }, [
    allRows,
    statusAtivos,
    statusInativos,
    comCelular,
    semCelular,
    tagQuery,
    birthdayStart,
    birthdayEnd,
    sortAsc,
  ]);

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function handleRemove(c: CustomerFull) {
    const ok = await confirm({
      title: 'Excluir cliente?',
      message: `Remover o cliente "${c.name}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    remove.mutate(c.id);
  }

  // Modo de seleção sobre os ids VISÍVEIS (página + filtros client-side).
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
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
          title: 'Excluir clientes?',
          message: `Excluir ${sel.count} cliente(s) selecionado(s)? Essa ação não pode ser desfeita.`,
          confirmLabel: 'Excluir',
          danger: true,
        });
        if (!ok) return;
        try {
          await Promise.all([...sel.selected].map((id) => remove.mutateAsync(id)));
          setActionsOpen(false);
          sel.cancel();
        } catch (err) {
          window.alert(
            err instanceof ApiClientError
              ? err.message
              : 'Não foi possível excluir os clientes.',
          );
        }
      },
    },
  ];

  // Ações contextuais do mobile: renderizadas na BottomNav (não no header).
  // Enquanto selectMode estiver ativo, a barra vira [Cancelar · Selecionar
  // todos · Ações] (buildSelectActions); senão, Filtros · Selecionar · Criar.
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
            onClick: () => setFiltersOpen((v) => !v),
          },
          {
            key: 'selecionar',
            label: 'Selecionar',
            icon: <IconCircleCheck size={22} />,
            onClick: sel.enter,
          },
          {
            key: 'criar',
            label: 'Criar',
            icon: <IconPlus size={22} />,
            onClick: () => setCreateOpen(true),
          },
        ],
    [sel.selectMode, sel.allSelected, sel.count],
  );

  // Botões numéricos de paginação (janela ao redor da página atual).
  const pageNumbers = useMemo(() => {
    const nums: number[] = [];
    const from = Math.max(1, page - 2);
    const to = Math.min(totalPages, from + 4);
    for (let i = from; i <= to; i++) nums.push(i);
    return nums;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col gap-3 pb-24 md:pb-0">
      {/* ── Cabeçalho ─────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-ink">Clientes</h2>
          {/* Botão "assista o tutorial" ao lado do título (Belasis) */}
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gold text-primary-foreground ring-4 ring-gold/25"
          >
            <IconPlay size={15} className="ml-0.5" />
          </span>
          {/* Ajuda da página (question-circle ao lado do título — Belasis) */}
          <HelpTooltip size={20} className="inline-flex items-center text-muted-ink hover:text-ink">
            Gerencie seus clientes: busque, filtre, cadastre e edite os cadastros.
          </HelpTooltip>
        </div>
        <div className="flex items-center gap-1.5">
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
              setPage(1);
            }}
            placeholder="Buscar cliente"
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`btn-ghost-hover hidden h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors md:inline-flex ${
              filtersOpen
                ? 'border-gold bg-gold text-primary-foreground'
                : 'border-line bg-card text-ink hover:bg-canvas'
            }`}
          >
            <IconFilter size={16} />
            <span className="hidden sm:inline">Filtrar</span>
          </button>
          {/* Ações em massa (T3): SEMPRE visível no desktop, à esquerda de "Novo".
              Fora do modo seleção → ativa o selectMode (checkboxes nas linhas).
              Em seleção → mostra a contagem e abre a BulkActionsSheet; um X ao
              lado sai do modo. NÃO existe barra "N selecionados" acima da tabela. */}
          {sel.selectMode ? (
            <div className="hidden items-center md:inline-flex">
              <button
                type="button"
                onClick={() =>
                  sel.count > 0 ? setActionsOpen(true) : sel.selectAll()
                }
                className={`btn-ghost-hover inline-flex h-9 items-center gap-1.5 rounded-l-lg border px-3 text-sm font-medium transition-colors ${
                  sel.count > 0
                    ? 'border-gold bg-gold text-primary-foreground hover:bg-gold-strong'
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
            className="btn-primary-hover hidden h-9 items-center gap-1.5 rounded-lg bg-gold px-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition-colors hover:bg-gold-strong md:inline-flex"
          >
            <IconPlus size={16} />
            <span>Novo</span>
          </button>
        </div>
      </header>

      {/* ── Busca — MOBILE apenas (sempre visível). No desktop a busca vive
             inline no header (T2), então este bloco é oculto em md+. ── */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line bg-card px-4 shadow-[var(--shadow-card)]">
          <IconSearch size={18} className="shrink-0 text-muted-ink" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            placeholder="Digite para buscar"
            aria-label="Buscar cliente"
            className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted-ink"
          />
        </div>
      </div>

      {/* Pílula de ordenação — visível no mobile (Belasis) */}
      <button
        type="button"
        onClick={() => setSortAsc((v) => !v)}
        className="inline-flex w-fit items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition-colors hover:bg-gold-strong md:hidden"
      >
        Ordenando por Nome
        <IconChevron size={16} className={sortAsc ? 'rotate-180' : ''} />
      </button>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ── Painel de filtros (desliza da esquerda no desktop) ── */}
        <FilterAside open={filtersOpen}>
            <div className="flex flex-col gap-5">
              {/* Status */}
              <FilterSection title="Status">
                <CheckRow
                  label="Ativos"
                  checked={statusAtivos}
                  onChange={setStatusAtivos}
                />
                <CheckRow
                  label="Inativos"
                  checked={statusInativos}
                  onChange={setStatusInativos}
                />
              </FilterSection>

              {/* Buscar tags */}
              <FilterSection title="Buscar tags">
                <input
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  placeholder="Selecionar Hashtags"
                  aria-label="Buscar tags"
                  className="h-9 w-full rounded-lg border border-line bg-card px-3 text-sm text-ink outline-none placeholder:text-muted-ink focus:border-gold"
                />
              </FilterSection>

              {/* Celular */}
              <FilterSection title="Celular">
                <CheckRow
                  label="Com celular"
                  checked={comCelular}
                  onChange={setComCelular}
                />
                <CheckRow
                  label="Sem celular"
                  checked={semCelular}
                  onChange={setSemCelular}
                />
              </FilterSection>

              {/* Débito */}
              <FilterSection title="Débito">
                {/* TODO: sem campo de débito no CustomerFull — filtros visuais */}
                <CheckRow
                  label="Com débito"
                  checked={comDebito}
                  onChange={setComDebito}
                />
                <CheckRow
                  label="Sem débito"
                  checked={semDebito}
                  onChange={setSemDebito}
                />
              </FilterSection>

              {/* Aniversário */}
              <FilterSection title="Aniversário">
                <div className="flex flex-col gap-2">
                  <DatePicker
                    value={birthdayStart}
                    onChange={setBirthdayStart}
                    ariaLabel="Data inicial"
                  />
                  <DatePicker
                    value={birthdayEnd}
                    onChange={setBirthdayEnd}
                    ariaLabel="Data final"
                  />
                </div>
              </FilterSection>

              {/* Última avaliação */}
              <FilterSection title="Última avaliação">
                {/* TODO: sem campo de avaliação — estrelas visuais */}
                <div className="flex items-center gap-1 text-muted-ink">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <IconStar key={i} size={18} />
                  ))}
                </div>
              </FilterSection>
            </div>
        </FilterAside>

        {/* ── Resultados ────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <div className="md:rounded-2xl md:border md:border-line md:bg-card md:shadow-[var(--shadow-card)]">
            {customers.isLoading ? (
              <TableSkeleton columns={6} card={false} />
            ) : customers.isError ? (
              <div className="p-6">
                <ErrorState onRetry={() => customers.refetch()} />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<IconUsers size={32} />}
                  title="Nenhum cliente encontrado"
                  description="Tente ajustar a busca ou os filtros."
                  action={
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gold px-3 text-sm font-semibold text-primary-foreground"
                    >
                      <IconPlus size={16} /> Novo
                    </button>
                  }
                />
              </div>
            ) : (
              <>
                {/* Tabela — desktop */}
                <div className="hidden overflow-clip md:block">
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
                        <th className="px-4 py-3">
                          {/* Nome — coluna-título fixa, ordenável (sorter ⇅). */}
                          <button
                            type="button"
                            onClick={() => setSortAsc((v) => !v)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-ink hover:text-ink"
                            aria-label="Ordenar por nome"
                          >
                            Nome
                            <IconChevron
                              size={14}
                              className={sortAsc ? 'rotate-180 text-gold' : 'text-gold'}
                            />
                          </button>
                        </th>
                        {cols.isVisible('email') && <th className="px-4 py-3">E-mail</th>}
                        {cols.isVisible('phone') && <th className="px-4 py-3">Celular</th>}
                        {cols.isVisible('birthday') && (
                          <th className="px-4 py-3">Nascimento</th>
                        )}
                        {cols.isVisible('credits') && (
                          <th className="px-4 py-3">Créditos</th>
                        )}
                        {cols.isVisible('notes') && (
                          <th className="px-4 py-3">Observações</th>
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
                                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-gold" />
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
                      {rows.map((c) => (
                        <tr
                          key={c.id}
                          className="border-b border-line last:border-0 transition-colors hover:bg-canvas"
                        >
                          <AnimatedSelectionCell active={sel.selectMode} className="px-4 py-2.5">
                            <Checkbox
                              isSelected={sel.isSelected(c.id)}
                              onChange={() => sel.toggle(c.id)}
                              aria-label={`Selecionar ${c.name}`}
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
                              onClick={() => setPerfil(c)}
                              className="flex items-center gap-2.5 text-left"
                              title={c.name}
                            >
                              <Avatar size="sm">
                                {c.avatarUrl && (
                                  <Avatar.Image src={c.avatarUrl} alt={c.name} />
                                )}
                                <Avatar.Fallback>{initials(c.name)}</Avatar.Fallback>
                              </Avatar>
                              <span className="font-medium leading-tight text-primary hover:underline">
                                {c.name}
                              </span>
                            </button>
                          </td>
                          {cols.isVisible('email') && (
                            <td className="max-w-[220px] truncate px-4 py-2.5 text-muted-ink">
                              {c.email ?? ''}
                            </td>
                          )}
                          {cols.isVisible('phone') && (
                            <td className="px-4 py-2.5 text-ink">{formatPhone(c.phone)}</td>
                          )}
                          {cols.isVisible('birthday') && (
                            <td className="px-4 py-2.5 text-ink">
                              {c.birthday ? formatDate(c.birthday) : ''}
                            </td>
                          )}
                          {cols.isVisible('credits') && (
                            <td className="whitespace-nowrap px-4 py-2.5 text-ink">
                              {/* TODO: sem saldo de créditos na listagem */}
                              R$&nbsp;0,00
                            </td>
                          )}
                          {cols.isVisible('notes') && (
                            <td className="max-w-[200px] truncate px-4 py-2.5 text-muted-ink">
                              {/* TODO: sem campo de observações na listagem */}
                            </td>
                          )}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <IconTip label="Editar">
                                <button
                                  type="button"
                                  aria-label="Editar"
                                  onClick={() => setPerfil(c)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-ink transition-colors hover:bg-canvas hover:text-gold"
                                >
                                  <IconPencil size={16} />
                                </button>
                              </IconTip>
                              <span className="h-4 w-px bg-line" />
                              <IconTip label="Excluir">
                                <button
                                  type="button"
                                  aria-label="Remover"
                                  onClick={() => handleRemove(c)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-pink transition-colors hover:bg-pink/10"
                                >
                                  <IconTrash size={16} />
                                </button>
                              </IconTip>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards — mobile (cada cliente em card elevado, igual ao Belasis) */}
                <ul className="flex flex-col gap-3 md:hidden">
                  {rows.map((c) => {
                    const cardBody = (
                      <>
                        {sel.selectMode && (
                          <AnimatedCheckbox checked={sel.isSelected(c.id)} />
                        )}
                        <Avatar size="lg">
                          {c.avatarUrl && (
                            <Avatar.Image src={c.avatarUrl} alt={c.name} />
                          )}
                          <Avatar.Fallback>{initials(c.name)}</Avatar.Fallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-base font-medium text-primary hover:underline">
                            {c.name}
                          </div>
                          <div className="truncate text-sm text-muted-ink">
                            {c.phone ? formatPhone(c.phone) : 'Sem telefone'}
                          </div>
                        </div>
                      </>
                    );
                    // Modo de seleção: o CARD INTEIRO alterna a seleção (qualquer
                    // ponto, inclusive o checkbox). Fora dele, abre o perfil.
                    // Um único <button> cobrindo o card todo evita "zonas mortas".
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (sel.selectMode) sel.toggle(c.id);
                            else setPerfil(c);
                          }}
                          aria-pressed={sel.selectMode ? sel.isSelected(c.id) : undefined}
                          className={`flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-4 text-left shadow-[var(--shadow-card)] ${
                            sel.selectMode && sel.isSelected(c.id)
                              ? 'border-gold ring-1 ring-gold/40'
                              : 'border-line'
                          }`}
                        >
                          {cardBody}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* Rodapé / paginação — T8: sticky no rodapé do scroll do <main>
                    (fundo sólido) enquanto se rola; "descola" ao chegar no fim.
                    md:rounded-b-2xl acompanha o card. */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-card px-4 pt-3 pb-6 md:sticky md:bottom-0 md:z-20 md:rounded-b-2xl">
                  <span className="text-xs text-muted-ink">{total} no total</span>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      aria-label="Página anterior"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="btn-ghost-hover inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-canvas"
                    >
                      <IconChevron size={16} className="rotate-90" />
                    </button>
                    {pageNumbers.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPage(n)}
                        aria-current={n === page ? 'page' : undefined}
                        className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm ${
                          n === page
                            ? 'border-gold bg-gold text-primary-foreground'
                            : 'border-line text-ink hover:bg-canvas'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    {/* Reticências + última página (igual ao Belasis) */}
                    {pageNumbers[pageNumbers.length - 1] < totalPages && (
                      <>
                        {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                          <span className="px-1 text-sm text-muted-ink">•••</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setPage(totalPages)}
                          className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-line px-2 text-sm text-ink hover:bg-canvas"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      aria-label="Próxima página"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="btn-ghost-hover inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-canvas"
                    >
                      <IconChevron size={16} className="-rotate-90" />
                    </button>
                    <span className="ml-2 whitespace-nowrap text-xs text-muted-ink">
                      {pageSize} / página
                    </span>
                    <div className="ml-2 flex items-center gap-1.5">
                      <span className="whitespace-nowrap text-xs text-muted-ink">
                        Vá até
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={gotoInput}
                        onChange={(e) => setGotoInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const n = Number(gotoInput);
                            if (Number.isFinite(n) && n >= 1 && n <= totalPages) setPage(n);
                            setGotoInput('');
                          }
                        }}
                        aria-label="Ir para a página"
                        placeholder="Página"
                        className="h-8 w-20 rounded-md border border-line bg-card px-2 text-sm text-ink outline-none placeholder:text-muted-ink focus:border-gold"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom-sheet das ações em lote do modo de seleção (mobile + desktop). */}
      <BulkActionsSheet
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        actions={bulkActions}
        count={sel.count}
      />

      <CustomerCreateModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <ClientePerfilModal
        customer={perfil}
        isOpen={Boolean(perfil)}
        onClose={() => setPerfil(null)}
      />
    </div>
  );
}

// ── Auxiliares do painel de filtros ────────────────────────────────
function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-ink">
        {title}
      </span>
      {children}
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
    <FilterCheckbox checked={checked} onChange={onChange}>
      {label}
    </FilterCheckbox>
  );
}
