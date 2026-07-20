import { useMemo, useState } from 'react';
import { Avatar } from '@heroui/react';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import {
  IconChevron,
  IconFilter,
  IconPencil,
  IconPlus,
  IconSearch,
  IconStar,
  IconTrash,
  IconUsers,
} from '../components/icons';
import { useCustomers } from '../lib/queries';
import { useDeleteCustomer } from '../lib/queries/clientes';
import { formatDate, initials } from '../lib/format';
import type { CustomerFull } from '../lib/types';
import { useAutoCreate } from '../lib/useAutoCreate';
import { useSetPageActions } from '../layout/PageActions';
import { ClientePerfilModal, CustomerCreateModal } from './ClientePerfilTabs';

// `YYYY-MM-DD` → `MMDD` para comparar aniversário ignorando o ano.
function monthDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = iso.slice(5, 10).replace('-', '');
  return s.length === 4 ? s : null;
}

export function ClientesPage() {
  // Busca
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

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

  // Seleção (checkbox por linha — visual, igual ao Belasis)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // "Vá até página" (input de salto do rodapé, igual ao Belasis)
  const [gotoInput, setGotoInput] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [perfil, setPerfil] = useState<CustomerFull | null>(null);
  useAutoCreate(() => setCreateOpen(true));

  // Ações contextuais do mobile: renderizadas na BottomNav (não no header).
  useSetPageActions(
    [
      {
        key: 'filtros',
        label: 'Filtros',
        icon: <IconFilter size={22} />,
        onClick: () => setFiltersOpen((v) => !v),
      },
      {
        key: 'novo',
        label: 'Novo',
        icon: <IconPlus size={22} />,
        onClick: () => setCreateOpen(true),
      },
    ],
    [],
  );

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
    return allRows.filter((c) => {
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
  }, [
    allRows,
    statusAtivos,
    statusInativos,
    comCelular,
    semCelular,
    tagQuery,
    birthdayStart,
    birthdayEnd,
  ]);

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleRemove(c: CustomerFull) {
    if (window.confirm(`Remover o cliente "${c.name}"?`)) {
      remove.mutate(c.id);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  function toggleSelectAll() {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  // Botões numéricos de paginação (janela ao redor da página atual).
  const pageNumbers = useMemo(() => {
    const nums: number[] = [];
    const from = Math.max(1, page - 2);
    const to = Math.min(totalPages, from + 4);
    for (let i = from; i <= to; i++) nums.push(i);
    return nums;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Cabeçalho ─────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-ink">Clientes</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={applySearch}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas"
          >
            <IconSearch size={16} />
            <span className="hidden sm:inline">Buscar</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`hidden h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors md:inline-flex ${
              filtersOpen
                ? 'border-gold bg-gold text-primary-foreground'
                : 'border-line bg-card text-ink hover:bg-canvas'
            }`}
          >
            <IconFilter size={16} />
            <span className="hidden sm:inline">Filtrar</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="hidden h-9 items-center gap-1.5 rounded-lg bg-gold px-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition-colors hover:bg-gold-strong md:inline-flex"
          >
            <IconPlus size={16} />
            <span>Novo</span>
          </button>
        </div>
      </header>

      {/* ── Busca (mobile-first, sempre visível) ─────────────── */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-card px-3">
          <IconSearch size={16} className="shrink-0 text-muted-ink" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            placeholder="Buscar por nome…"
            aria-label="Buscar cliente"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-ink"
          />
        </div>
        <button
          type="button"
          onClick={applySearch}
          className="inline-flex h-10 items-center rounded-lg bg-gold px-4 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition-colors hover:bg-gold-strong"
        >
          Buscar
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ── Painel de filtros ─────────────────────────────── */}
        {filtersOpen && (
          <aside className="w-full shrink-0 rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] lg:w-64">
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
                  <input
                    type="date"
                    value={birthdayStart}
                    onChange={(e) => setBirthdayStart(e.target.value)}
                    aria-label="Data inicial"
                    className="h-9 w-full rounded-lg border border-line bg-card px-3 text-sm text-ink outline-none focus:border-gold"
                  />
                  <input
                    type="date"
                    value={birthdayEnd}
                    onChange={(e) => setBirthdayEnd(e.target.value)}
                    aria-label="Data final"
                    className="h-9 w-full rounded-lg border border-line bg-card px-3 text-sm text-ink outline-none focus:border-gold"
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
          </aside>
        )}

        {/* ── Resultados ────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
            {customers.isLoading ? (
              <div className="p-6">
                <LoadingState />
              </div>
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
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                        <th className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label="Selecionar todos"
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            className="h-4 w-4 accent-gold"
                          />
                        </th>
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3">E-mail</th>
                        <th className="px-4 py-3">Celular</th>
                        <th className="px-4 py-3">Nascimento</th>
                        <th className="px-4 py-3 text-right">Créditos</th>
                        <th className="px-4 py-3">Observações</th>
                        <th className="w-20 px-4 py-3 text-center" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr
                          key={c.id}
                          className="border-b border-line last:border-0 transition-colors hover:bg-canvas"
                        >
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              aria-label={`Selecionar ${c.name}`}
                              checked={selected.has(c.id)}
                              onChange={() => toggleSelect(c.id)}
                              className="h-4 w-4 accent-gold"
                            />
                          </td>
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
                              <span className="font-medium leading-tight text-ink hover:text-gold">
                                {c.name}
                              </span>
                            </button>
                          </td>
                          <td className="max-w-[220px] truncate px-4 py-2.5 text-muted-ink">
                            {c.email ?? ''}
                          </td>
                          <td className="px-4 py-2.5 text-ink">{c.phone ?? ''}</td>
                          <td className="px-4 py-2.5 text-ink">
                            {c.birthday ? formatDate(c.birthday) : ''}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-ink">
                            {/* TODO: sem saldo de créditos na listagem */}
                            R$&nbsp;0,00
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-2.5 text-muted-ink">
                            {/* TODO: sem campo de observações na listagem */}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                aria-label="Editar"
                                onClick={() => setPerfil(c)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-ink transition-colors hover:bg-canvas hover:text-gold"
                              >
                                <IconPencil size={16} />
                              </button>
                              <span className="h-4 w-px bg-line" />
                              <button
                                type="button"
                                aria-label="Remover"
                                onClick={() => handleRemove(c)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-pink transition-colors hover:bg-pink/10"
                              >
                                <IconTrash size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards — mobile */}
                <ul className="flex flex-col md:hidden">
                  {rows.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 border-b border-line px-3 py-3 last:border-0"
                    >
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${c.name}`}
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="h-4 w-4 shrink-0 accent-gold"
                      />
                      <button
                        type="button"
                        onClick={() => setPerfil(c)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <Avatar size="lg">
                          {c.avatarUrl && (
                            <Avatar.Image src={c.avatarUrl} alt={c.name} />
                          )}
                          <Avatar.Fallback>{initials(c.name)}</Avatar.Fallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">{c.name}</div>
                          <div className="truncate text-sm text-muted-ink">
                            {c.phone ?? 'Sem telefone'}
                          </div>
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label="Editar"
                          onClick={() => setPerfil(c)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-ink hover:text-gold"
                        >
                          <IconPencil size={18} />
                        </button>
                        <button
                          type="button"
                          aria-label="Remover"
                          onClick={() => handleRemove(c)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-pink"
                        >
                          <IconTrash size={18} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Rodapé / paginação */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
                  <span className="text-xs text-muted-ink">{total} no total</span>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      aria-label="Página anterior"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-canvas"
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
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-canvas"
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
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-gold"
      />
      {label}
    </label>
  );
}
