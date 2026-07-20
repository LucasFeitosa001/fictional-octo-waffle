import { useEffect, useMemo, useState } from 'react';
import { Button, Input, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../components/Drawer';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import {
  IconArrowDown,
  IconArrowUp,
  IconDownload,
  IconFilter,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTruck,
} from '../components/icons';
import { formatNumber } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
  type Supplier,
} from '../lib/queries/catalogo';

type StatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZE = 20;

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

export function FornecedoresPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  function exportCsv() {
    downloadCsv<Supplier>(
      'fornecedores',
      [
        { header: 'Fornecedor', value: (s) => s.name },
        { header: 'E-mail', value: (s) => s.email ?? '' },
        { header: 'Telefone', value: (s) => readAddress(s.addressJson).phone2 ?? '' },
        { header: 'Celular', value: (s) => s.phone ?? '' },
        { header: 'CNPJ', value: (s) => s.cnpj ?? '' },
        { header: 'Status', value: (s) => (s.active ? 'Ativo' : 'Inativo') },
      ],
      rows,
    );
  }

  async function handleRemove(s: Supplier) {
    setMessage(null);
    if (!window.confirm(`Remover o fornecedor "${s.name}"?`)) return;
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

  return (
    <div className="pb-10">
      {/* Cabeçalho: título + Buscar / Filtrar / Exportar / Novo (igual Belasis) */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Fornecedores</h1>
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

      {message && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {message}
        </div>
      )}

      {/* Barra de busca (toggle) */}
      {searchOpen && (
        <div className="mb-4 flex max-w-xl items-center gap-2">
          <TextField
            value={searchInput}
            onChange={setSearchInput}
            className="min-w-0 flex-1"
            aria-label="Buscar fornecedor"
          >
            <Input
              placeholder="Buscar por nome, CNPJ, telefone…"
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
          </aside>
        )}

        {/* Conteúdo principal: tabela / cards */}
        <div className="min-w-0 flex-1">
          {suppliers.isLoading ? (
            <LoadingState />
          ) : suppliers.isError ? (
            <ErrorState onRetry={() => suppliers.refetch()} />
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)]">
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
          ) : (
            <>
              {/* ===== Desktop: tabela ===== */}
              <div className="hidden overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)] md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
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
                      <th className="px-4 py-3 font-semibold">E-mail</th>
                      <th className="px-4 py-3 font-semibold">Telefone</th>
                      <th className="px-4 py-3 font-semibold">Celular</th>
                      <th className="px-4 py-3 font-semibold">CNPJ</th>
                      <th className="px-4 py-3 text-center font-semibold">Ações</th>
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
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setEditing(s)}
                              className="flex w-full items-center gap-2.5 text-left"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-primary">
                                <IconTruck size={16} />
                              </span>
                              <span className="min-w-0 truncate font-medium text-ink">
                                {s.name}
                              </span>
                              {!s.active && (
                                <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--sp-ink)_8%,transparent)] px-2 py-0.5 text-[10px] font-medium text-muted-ink">
                                  Inativo
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-muted-ink">{s.email || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-ink">{addr.phone2 || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-ink">{s.phone || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-ink">{s.cnpj || '—'}</td>
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
                      className="rounded-xl border border-line bg-card p-3 shadow-[var(--shadow-card)]"
                    >
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-primary">
                          <IconTruck size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="min-w-0 truncate font-medium text-ink">
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
      <button
        type="button"
        aria-label="Editar"
        title="Editar"
        onClick={onEdit}
        className="rounded p-1 hover:bg-canvas hover:text-primary"
      >
        <IconPencil size={16} />
      </button>
      <span className="h-4 w-px bg-line" />
      <button
        type="button"
        aria-label="Remover"
        title="Remover"
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
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------
// Drawer lateral de cadastro/edição de fornecedor (clone do Belasis)
// ---------------------------------------------------------------------

function SupplierDrawer({
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
  // Endereço
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const addr = readAddress(supplier?.addressJson);
    setName(supplier?.name ?? '');
    setEmail(supplier?.email ?? '');
    setPhone(supplier?.phone ?? '');
    setPhone2(addr.phone2 ?? '');
    setStateRegistration(supplier?.stateRegistration ?? '');
    setCnpj(supplier?.cnpj ?? '');
    setActive(supplier?.active ?? true);
    setCep(addr.cep ?? '');
    setLogradouro(addr.logradouro ?? addr.line ?? '');
    setNumero(addr.numero ?? '');
    setComplemento(addr.complemento ?? '');
    setBairro(addr.bairro ?? '');
    setEstado(addr.estado ?? '');
    setCidade(addr.cidade ?? '');
    setError(null);
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

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar fornecedor' : 'Novo fornecedor'}
      widthClass="sm:w-[650px]"
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
        {/* Grade 2 colunas (ant-col-sm-12 no Belasis) */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" required>
            <TextField value={name} onChange={setName} aria-label="Nome">
              <Input
                placeholder="Nome"
                className="focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </TextField>
          </Field>
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
            <TextField value={phone} onChange={setPhone} aria-label="Celular">
              <Input
                placeholder="(00) 00000-0000"
                className="focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </TextField>
          </Field>
          <Field label="Telefone">
            <TextField value={phone2} onChange={setPhone2} aria-label="Telefone">
              <Input
                placeholder="(00) 0000-0000"
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

        {/* Ativo — toggle com descrição (igual Belasis) */}
        <div className="flex items-center justify-between rounded-md border border-line bg-canvas p-3">
          <div className="flex min-w-0 flex-col pr-3">
            <span className="text-sm font-medium text-ink">Ativo</span>
            <span className="text-xs text-muted-ink">
              Se ativo, aparecerá na listagem do sistema para compras, movimentações
              financeiras etc
            </span>
          </div>
          <Switch checked={active} onChange={setActive} label="Ativo" />
        </div>

        {/* Endereço */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-ink">
            Endereço
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CEP">
              <TextField value={cep} onChange={setCep} aria-label="CEP">
                <Input
                  placeholder="00000-000"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
            </Field>
            <Field label="Logradouro">
              <TextField value={logradouro} onChange={setLogradouro} aria-label="Logradouro">
                <Input
                  placeholder="Logradouro"
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
              <TextField value={estado} onChange={setEstado} aria-label="Estado">
                <Input
                  placeholder="Estado"
                  className="focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </TextField>
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
        </div>

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

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-[color-mix(in_oklab,var(--sp-ink)_20%,transparent)]',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}
