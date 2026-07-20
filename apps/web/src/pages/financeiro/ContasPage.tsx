import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, Input, ListBox, Select, Switch, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, LoadingState } from '../../components/States';
import { Drawer } from '../../components/Drawer';
import {
  IconChevron,
  IconCreditCard,
  IconFilter,
  IconFolder,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '../../components/icons';
import {
  useCreateFinancialAccount,
  useCreateFinancialCategory,
  useCreatePaymentMethod,
  useDeleteFinancialAccount,
  useDeleteFinancialCategory,
  useDeletePaymentMethod,
  useFinancialAccounts,
  useFinancialCategories,
  usePaymentMethods,
  useUpdateFinancialAccount,
  useUpdateFinancialCategory,
  useUpdatePaymentMethod,
  type FinancialAccount,
  type FinancialAccountType,
  type FinancialCategory,
  type FinancialCategoryKind,
  type PaymentMethod,
} from '../../lib/queries/financeiro';
import { useSetPageActions } from '../../layout/PageActions';

const CARD_CLASS =
  'border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]';

const PAGE_SIZE = 20;

const ACCOUNT_TYPE_LABEL: Record<FinancialAccountType, string> = {
  cash: 'Caixa',
  bank: 'Banco',
};

const CATEGORY_KIND_LABEL: Record<FinancialCategoryKind, string> = {
  credit: 'Crédito',
  debit: 'Débito',
};

type TabKey = 'contas' | 'formas' | 'categorias';

// Abas do Belasis: badges de texto puro (Contas · Formas de pagamento ·
// Categorias), sem ícones.
const TABS: { id: TabKey; label: string }[] = [
  { id: 'contas', label: 'Contas' },
  { id: 'formas', label: 'Formas de pagamento' },
  { id: 'categorias', label: 'Categorias' },
];

function byName<T extends { name: string }>(a: T, b: T) {
  return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
}

/**
 * Ações de linha no estilo Belasis: lápis (editar) · divisória · lixeira
 * (excluir, em vermelho). Ícones anticon → equivalentes lucide.
 */
function RowActions({
  onEdit,
  onRemove,
  removing,
}: {
  onEdit: () => void;
  onRemove: () => void;
  removing?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label="Editar"
        title="Editar"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-cream hover:text-foreground"
      >
        <IconPencil size={16} />
      </button>
      <span className="h-4 w-px bg-[var(--color-soft-border)]" aria-hidden />
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        aria-label="Remover"
        title="Remover"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
      >
        <IconTrash size={16} />
      </button>
    </div>
  );
}

export function ContasPage() {
  const [tab, setTab] = useState<TabKey>('contas');
  const [page, setPage] = useState(1);

  // Toolbar do Belasis: Buscar (input revelado) · Filtrar (drawer lateral) · Novo.
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // Filtro de Status do Belasis: caixas "Ativada" / "Desativada". Padrão do
  // Belasis é mostrar apenas as ativadas.
  const [showActive, setShowActive] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const [accountDrawer, setAccountDrawer] = useState(false);
  const [methodDrawer, setMethodDrawer] = useState(false);
  const [categoryDrawer, setCategoryDrawer] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);

  const accounts = useFinancialAccounts();
  const methods = usePaymentMethods();
  const categories = useFinancialCategories();

  const allAccounts = accounts.data ?? [];
  const allMethods = methods.data ?? [];
  const allCategories = categories.data ?? [];

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of allAccounts) map.set(a.id, a.name);
    return map;
  }, [allAccounts]);

  const q = search.trim().toLowerCase();
  function matchSearch(name: string) {
    return !q || name.toLowerCase().includes(q);
  }
  function matchActive(active: boolean) {
    return (active && showActive) || (!active && showInactive);
  }

  // Status só se aplica onde o backend expõe `active` (contas e categorias).
  const supportsStatus = tab !== 'formas';

  const filteredAccounts = useMemo(
    () =>
      allAccounts.filter((a) => matchActive(a.active) && matchSearch(a.name)).sort(byName),
    [allAccounts, showActive, showInactive, q],
  );
  const filteredCategories = useMemo(
    () =>
      allCategories
        .filter((c) => matchActive(c.active) && matchSearch(c.name))
        .sort(byName),
    [allCategories, showActive, showInactive, q],
  );
  const filteredMethods = useMemo(
    () => allMethods.filter((m) => matchSearch(m.name)).sort(byName),
    [allMethods, q],
  );

  // Qualquer mudança de aba/busca/filtro volta para a primeira página.
  useEffect(() => {
    setPage(1);
  }, [tab, q, showActive, showInactive]);

  const delAccount = useDeleteFinancialAccount();
  const delMethod = useDeletePaymentMethod();
  const delCategory = useDeleteFinancialCategory();

  function openCreate() {
    if (tab === 'contas') {
      setEditingAccount(null);
      setAccountDrawer(true);
    } else if (tab === 'formas') {
      setEditingMethod(null);
      setMethodDrawer(true);
    } else {
      setEditingCategory(null);
      setCategoryDrawer(true);
    }
  }

  async function removeAccount(a: FinancialAccount) {
    if (!window.confirm(`Remover a conta "${a.name}"?`)) return;
    try {
      await delAccount.mutateAsync(a.id);
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.message : 'Não foi possível remover a conta.');
    }
  }
  async function removeMethod(m: PaymentMethod) {
    if (!window.confirm(`Remover a forma "${m.name}"?`)) return;
    try {
      await delMethod.mutateAsync(m.id);
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.message : 'Não foi possível remover a forma.');
    }
  }
  async function removeCategory(c: FinancialCategory) {
    if (!window.confirm(`Remover a categoria "${c.name}"?`)) return;
    try {
      await delCategory.mutateAsync(c.id);
    } catch (err) {
      window.alert(
        err instanceof ApiClientError ? err.message : 'Não foi possível remover a categoria.',
      );
    }
  }

  const accountColumns: Column<FinancialAccount>[] = [
    {
      key: 'name',
      header: 'Nome',
      isRowHeader: true,
      render: (a) => (
        <span className={a.active ? 'font-medium text-foreground' : 'font-medium text-muted'}>
          {a.name}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Detalhes',
      render: (a) => (
        <Chip variant="soft" color="accent" size="sm">
          {ACCOUNT_TYPE_LABEL[a.type]}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (a) => (
        <RowActions
          onEdit={() => {
            setEditingAccount(a);
            setAccountDrawer(true);
          }}
          onRemove={() => removeAccount(a)}
          removing={delAccount.isPending}
        />
      ),
    },
  ];

  const methodColumns: Column<PaymentMethod>[] = [
    {
      key: 'name',
      header: 'Nome',
      isRowHeader: true,
      render: (m) => <span className="font-medium text-foreground">{m.name}</span>,
    },
    {
      key: 'fee',
      header: 'Taxa',
      render: (m) => `${Number(m.feePercent).toFixed(2)}%`,
    },
    {
      key: 'account',
      header: 'Conta',
      render: (m) =>
        m.defaultAccountId ? (
          accountNameById.get(m.defaultAccountId) ?? '—'
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'settlement',
      header: 'Prazo de recebimento',
      render: (m) => (m.settlementDays > 0 ? `${m.settlementDays} dia(s)` : 'À vista'),
    },
    {
      key: 'cash',
      header: 'Baixa no financeiro',
      render: (m) => (
        <Chip variant="soft" color={m.goesToCash ? 'success' : 'default'} size="sm">
          {m.goesToCash ? 'Automática' : 'Manual'}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (m) => (
        <RowActions
          onEdit={() => {
            setEditingMethod(m);
            setMethodDrawer(true);
          }}
          onRemove={() => removeMethod(m)}
          removing={delMethod.isPending}
        />
      ),
    },
  ];

  const categoryColumns: Column<FinancialCategory>[] = [
    {
      key: 'name',
      header: 'Nome',
      isRowHeader: true,
      render: (c) => (
        <span className={c.active ? 'font-medium text-foreground' : 'font-medium text-muted'}>
          {c.name}
        </span>
      ),
    },
    {
      key: 'kind',
      header: 'Crédito/Débito',
      render: (c) => (
        <Chip variant="soft" color={c.kind === 'credit' ? 'success' : 'danger'} size="sm">
          {CATEGORY_KIND_LABEL[c.kind]}
        </Chip>
      ),
    },
    {
      key: 'commission',
      header: 'Comissionável',
      render: (c) => (c.countsAsCommission ? 'Sim' : 'Não'),
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <RowActions
          onEdit={() => {
            setEditingCategory(c);
            setCategoryDrawer(true);
          }}
          onRemove={() => removeCategory(c)}
          removing={delCategory.isPending}
        />
      ),
    },
  ];

  const isLoading =
    tab === 'contas'
      ? accounts.isLoading
      : tab === 'formas'
        ? methods.isLoading
        : categories.isLoading;

  const rowCount =
    tab === 'contas'
      ? filteredAccounts.length
      : tab === 'formas'
        ? filteredMethods.length
        : filteredCategories.length;

  const pageCount = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageAccounts = filteredAccounts.slice(pageStart, pageStart + PAGE_SIZE);
  const pageMethods = filteredMethods.slice(pageStart, pageStart + PAGE_SIZE);
  const pageCategories = filteredCategories.slice(pageStart, pageStart + PAGE_SIZE);

  const searchPlaceholder =
    tab === 'contas'
      ? 'Buscar conta…'
      : tab === 'formas'
        ? 'Buscar forma de pagamento…'
        : 'Buscar categoria…';

  // Belasis rotula o botão de criação sempre como "Novo" (independente da aba).
  const newLabel = 'Novo';

  // Badge de filtros ativos: desvios do padrão do Belasis (só Ativada).
  const statusFilterCount =
    (showInactive ? 1 : 0) + (!showActive ? 1 : 0);

  function changeTab(next: TabKey) {
    setTab(next);
    setSearch('');
  }

  // Mobile: as ações da toolbar (Buscar · Filtrar · Novo) vivem na BottomNav
  // (padrão Belasis). Cada onClick dispara o mesmo handler do botão desktop.
  useSetPageActions(
    [
      {
        key: 'buscar',
        label: 'Buscar',
        icon: <IconSearch size={22} />,
        onClick: () => setSearchOpen((o) => !o),
      },
      ...(supportsStatus
        ? [
            {
              key: 'filtrar',
              label: 'Filtrar',
              icon: <IconFilter size={22} />,
              onClick: () => setFilterOpen(true),
            },
          ]
        : []),
      {
        key: 'novo',
        label: newLabel,
        icon: <IconPlus size={22} />,
        onClick: openCreate,
      },
    ],
    [tab, supportsStatus],
  );

  return (
    <div>
      {/* Cabeçalho + toolbar do Belasis: título à esquerda; à direita
          Buscar · Filtrar · Novo. */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">
            Cadastros
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <Button
            variant={searchOpen ? 'primary' : 'outline'}
            onClick={() => setSearchOpen((o) => !o)}
            className="hidden md:inline-flex"
          >
            <IconSearch size={16} /> Buscar
          </Button>
          {supportsStatus && (
            <Button
              variant="outline"
              onClick={() => setFilterOpen(true)}
              className="relative hidden md:inline-flex"
            >
              <IconFilter size={16} /> Filtrar
              {statusFilterCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-semibold text-ink">
                  {statusFilterCount}
                </span>
              )}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={openCreate}
            className="col-span-2 hidden sm:col-span-1 md:inline-flex"
          >
            <IconPlus size={16} /> {newLabel}
          </Button>
        </div>
      </div>

      {/* Abas (pílulas) do Belasis: Contas · Formas de pagamento · Categorias. */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => changeTab(t.id)}
              className={
                'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ' +
                (active
                  ? 'bg-gold text-ink shadow-[var(--shadow-gold)]'
                  : 'border border-[var(--color-soft-border)] bg-white text-foreground hover:bg-cream')
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Buscar (revelado ao clicar em Buscar) */}
      {searchOpen && (
        <div className="mb-4">
          <TextField value={search} onChange={setSearch} aria-label="Buscar">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <IconSearch size={16} />
              </span>
              <Input autoFocus placeholder={searchPlaceholder} className="pl-9" />
            </div>
          </TextField>
        </div>
      )}

      <Card className={CARD_CLASS}>
        <Card.Content className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted">Ordenado por Nome</span>
            <span className="text-xs text-muted">
              {rowCount > 0 ? `${rowCount} no total` : '0 registro(s)'}
            </span>
          </div>

          {tab === 'contas' &&
            (isLoading ? (
              <LoadingState />
            ) : filteredAccounts.length === 0 ? (
              <EmptyState
                icon={<IconFolder size={32} />}
                title="Nenhuma conta encontrada"
                description="Cadastre caixa ou contas bancárias para registrar movimentações."
              />
            ) : (
              <DataTable
                aria-label="Contas financeiras"
                columns={accountColumns}
                rows={pageAccounts}
                getKey={(a) => a.id}
              />
            ))}

          {tab === 'formas' &&
            (isLoading ? (
              <LoadingState />
            ) : filteredMethods.length === 0 ? (
              <EmptyState
                icon={<IconCreditCard size={32} />}
                title="Nenhuma forma de pagamento"
                description="Cadastre dinheiro, pix, crédito ou débito com taxa e prazo de recebimento."
              />
            ) : (
              <DataTable
                aria-label="Formas de pagamento"
                columns={methodColumns}
                rows={pageMethods}
                getKey={(m) => m.id}
              />
            ))}

          {tab === 'categorias' &&
            (isLoading ? (
              <LoadingState />
            ) : filteredCategories.length === 0 ? (
              <EmptyState
                icon={<IconFolder size={32} />}
                title="Nenhuma categoria encontrada"
                description="Organize o plano de contas por categoria de crédito e débito."
              />
            ) : (
              <DataTable
                aria-label="Categorias financeiras"
                columns={categoryColumns}
                rows={pageCategories}
                getKey={(c) => c.id}
              />
            ))}

          {/* Paginação do Belasis: "X no total" + prev/next + 20 / página. */}
          {rowCount > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-soft-border)] pt-3">
              <span className="text-xs text-muted">{rowCount} no total</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Página anterior"
                  isDisabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <IconChevron size={14} className="rotate-90" />
                </Button>
                <span className="px-1 text-xs text-muted">
                  Página {page} de {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Próxima página"
                  isDisabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  <IconChevron size={14} className="-rotate-90" />
                </Button>
                <span className="ml-1 hidden text-xs text-muted sm:inline">
                  {PAGE_SIZE} / página
                </span>
              </div>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Filtrar: drawer lateral (direita) com a seção Status do Belasis. */}
      <StatusFilterDrawer
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        showActive={showActive}
        showInactive={showInactive}
        setShowActive={setShowActive}
        setShowInactive={setShowInactive}
      />

      {/* Novo/Editar = drawers laterais (direita). */}
      <ContaDrawer
        isOpen={accountDrawer}
        onClose={() => setAccountDrawer(false)}
        editing={editingAccount}
      />
      <FormaDrawer
        isOpen={methodDrawer}
        onClose={() => setMethodDrawer(false)}
        editing={editingMethod}
      />
      <CategoriaDrawer
        isOpen={categoryDrawer}
        onClose={() => setCategoryDrawer(false)}
        editing={editingCategory}
      />
    </div>
  );
}

/** Drawer "Filtrar" com a seção Status (Ativada / Desativada), como no Belasis. */
function StatusFilterDrawer({
  isOpen,
  onClose,
  showActive,
  showInactive,
  setShowActive,
  setShowInactive,
}: {
  isOpen: boolean;
  onClose: () => void;
  showActive: boolean;
  showInactive: boolean;
  setShowActive: (v: boolean) => void;
  setShowInactive: (v: boolean) => void;
}) {
  const options: { label: string; value: boolean; set: (v: boolean) => void }[] = [
    { label: 'Ativada', value: showActive, set: setShowActive },
    { label: 'Desativada', value: showInactive, set: setShowInactive },
  ];

  const footer = (
    <>
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => {
          setShowActive(true);
          setShowInactive(false);
        }}
      >
        Limpar filtros
      </Button>
      <Button variant="primary" className="w-full sm:w-auto" onClick={onClose}>
        Aplicar
      </Button>
    </>
  );

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Filtrar" footer={footer} widthClass="sm:w-[420px]">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Status</span>
        <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--color-soft-border)]">
          {options.map((o, i) => (
            <label
              key={o.label}
              className={
                'flex cursor-pointer items-center gap-3 px-3 py-3 text-sm transition-colors hover:bg-cream ' +
                (i > 0 ? 'border-t border-[var(--color-soft-border)]' : '')
              }
            >
              <input
                type="checkbox"
                checked={o.value}
                onChange={(e) => o.set(e.target.checked)}
                className="h-4 w-4 accent-[color:var(--sp-primary,#505afb)]"
              />
              <span className="text-foreground">{o.label}</span>
            </label>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

/** Rótulo de campo do formulário dos drawers. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

/** Switch de linha (label à esquerda, controle à direita) dos drawers. */
function RowSwitch({
  label,
  isSelected,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Switch
      isSelected={isSelected}
      onChange={onChange}
      className="flex h-11 items-center justify-between gap-3 rounded-lg border border-[var(--color-soft-border)] bg-white px-3"
    >
      <span className="text-sm text-foreground">{label}</span>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}

const NONE = '';

/**
 * Drawer "Conta bancária" (Novo/Editar), clonado de drawer-1.html: linha
 * Nome (2/3) + Saldo (1/3), Acesso (somente leitura) e switch Ativa.
 */
function ContaDrawer({
  isOpen,
  onClose,
  editing,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: FinancialAccount | null;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FinancialAccountType>('cash');
  const [initialBalance, setInitialBalance] = useState('');
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const create = useCreateFinancialAccount();
  const update = useUpdateFinancialAccount();
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setName(editing.name);
        setType(editing.type);
        setInitialBalance(String(editing.initialBalance));
        setActive(editing.active);
      } else {
        setName('');
        setType('cash');
        setInitialBalance('');
        setActive(true);
      }
      setFormError(null);
      setSuccess(false);
    }
  }, [isOpen, editing]);

  const canConfirm = name.trim().length >= 2 && !isPending;

  async function handleConfirm() {
    setFormError(null);
    const base = {
      name: name.trim(),
      type,
      initialBalance: initialBalance ? Number(initialBalance.replace(',', '.')) : undefined,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body: { ...base, active } });
        onClose();
      } else {
        await create.mutateAsync(base);
        setSuccess(true);
      }
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar a conta.');
    }
  }

  const footer = success ? (
    <Button variant="primary" className="w-full sm:w-auto" onClick={onClose}>
      Fechar
    </Button>
  ) : (
    <>
      <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
        Cancelar
      </Button>
      <Button
        variant="primary"
        className="w-full sm:w-auto"
        isDisabled={!canConfirm}
        onClick={handleConfirm}
      >
        {isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Editar conta' : 'Conta bancária'}
      footer={footer}
      widthClass="sm:w-[480px]"
    >
      {success ? (
        <SuccessBlock text="Conta criada com sucesso!" />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Nome (2/3) + Saldo (1/3), como no Belasis */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Nome">
                <TextField value={name} onChange={setName} aria-label="Nome">
                  <Input placeholder="Nome" />
                </TextField>
              </Field>
            </div>
            <div className="col-span-1">
              <Field label="Saldo">
                <TextField
                  value={initialBalance}
                  onChange={setInitialBalance}
                  aria-label="Saldo"
                >
                  <Input placeholder="R$ 0,00" inputMode="decimal" />
                </TextField>
              </Field>
            </div>
          </div>

          {/* Tipo — não existe no drawer do Belasis (usa Belasis Pay), mas o
              backend do SalonPass separa Caixa/Banco. */}
          <Field label="Tipo">
            <Select
              aria-label="Tipo"
              selectedKey={type}
              onSelectionChange={(k) => setType(String(k) as FinancialAccountType)}
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="cash" textValue="Caixa">
                    Caixa
                  </ListBox.Item>
                  <ListBox.Item id="bank" textValue="Banco">
                    Banco
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </Field>

          {/* Acesso (somente leitura, como no Belasis) */}
          <Field label="Acesso">
            <div className="rounded-md border border-[var(--color-soft-border)] bg-cream/40 px-3 py-2 text-sm text-muted">
              Qualquer usuário pode acessar
            </div>
          </Field>

          <RowSwitch label="Ativa" isSelected={active} onChange={setActive} />

          {formError && <FormError message={formError} />}
        </div>
      )}
    </Drawer>
  );
}

/** Drawer de Forma de pagamento (Novo/Editar). */
function FormaDrawer({
  isOpen,
  onClose,
  editing,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: PaymentMethod | null;
}) {
  const [name, setName] = useState('');
  const [feePercent, setFeePercent] = useState('');
  const [settlementDays, setSettlementDays] = useState('');
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const [goesToCash, setGoesToCash] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const accounts = useFinancialAccounts();
  const create = useCreatePaymentMethod();
  const update = useUpdatePaymentMethod();
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setName(editing.name);
        setFeePercent(String(editing.feePercent));
        setSettlementDays(String(editing.settlementDays));
        setDefaultAccountId(editing.defaultAccountId ?? '');
        setGoesToCash(editing.goesToCash);
      } else {
        setName('');
        setFeePercent('');
        setSettlementDays('');
        setDefaultAccountId('');
        setGoesToCash(false);
      }
      setFormError(null);
      setSuccess(false);
    }
  }, [isOpen, editing]);

  const canConfirm = name.trim().length >= 1 && !isPending;

  async function handleConfirm() {
    setFormError(null);
    const body = {
      name: name.trim(),
      feePercent: feePercent ? Number(feePercent.replace(',', '.')) : undefined,
      settlementDays: settlementDays ? Number(settlementDays) : undefined,
      defaultAccountId: defaultAccountId || undefined,
      goesToCash,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body });
        onClose();
      } else {
        await create.mutateAsync(body);
        setSuccess(true);
      }
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar a forma.');
    }
  }

  const footer = success ? (
    <Button variant="primary" className="w-full sm:w-auto" onClick={onClose}>
      Fechar
    </Button>
  ) : (
    <>
      <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
        Cancelar
      </Button>
      <Button
        variant="primary"
        className="w-full sm:w-auto"
        isDisabled={!canConfirm}
        onClick={handleConfirm}
      >
        {isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Editar forma de pagamento' : 'Forma de pagamento'}
      footer={footer}
      widthClass="sm:w-[480px]"
    >
      {success ? (
        <SuccessBlock text="Forma criada com sucesso!" />
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Nome">
            <TextField value={name} onChange={setName} aria-label="Nome">
              <Input placeholder="Ex.: Cartão de crédito" />
            </TextField>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Taxa (%)">
              <TextField value={feePercent} onChange={setFeePercent} aria-label="Taxa">
                <Input placeholder="0,00" inputMode="decimal" />
              </TextField>
            </Field>
            <Field label="Prazo de recebimento (dias)">
              <TextField
                value={settlementDays}
                onChange={setSettlementDays}
                aria-label="Prazo de recebimento"
              >
                <Input placeholder="0" inputMode="numeric" />
              </TextField>
            </Field>
          </div>

          <Field label="Conta">
            <Select
              aria-label="Conta"
              selectedKey={defaultAccountId || null}
              onSelectionChange={(k) => setDefaultAccountId(k ? String(k) : NONE)}
            >
              <Select.Trigger>
                <Select.Value>
                  {({ isPlaceholder, selectedText }) =>
                    isPlaceholder ? 'Selecione (opcional)' : selectedText
                  }
                </Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {(accounts.data ?? []).map((a) => (
                    <ListBox.Item key={a.id} id={a.id} textValue={a.name}>
                      {a.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </Field>

          <RowSwitch
            label="Baixa automática no financeiro"
            isSelected={goesToCash}
            onChange={setGoesToCash}
          />

          {formError && <FormError message={formError} />}
        </div>
      )}
    </Drawer>
  );
}

/** Drawer de Categoria (Novo/Editar). */
function CategoriaDrawer({
  isOpen,
  onClose,
  editing,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: FinancialCategory | null;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FinancialCategoryKind>('credit');
  const [countsAsCommission, setCountsAsCommission] = useState(false);
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const create = useCreateFinancialCategory();
  const update = useUpdateFinancialCategory();
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setName(editing.name);
        setKind(editing.kind);
        setCountsAsCommission(editing.countsAsCommission);
        setActive(editing.active);
      } else {
        setName('');
        setKind('credit');
        setCountsAsCommission(false);
        setActive(true);
      }
      setFormError(null);
      setSuccess(false);
    }
  }, [isOpen, editing]);

  const canConfirm = name.trim().length >= 2 && !isPending;

  async function handleConfirm() {
    setFormError(null);
    const base = {
      name: name.trim(),
      kind,
      countsAsCommission,
      isExpense: kind === 'debit',
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body: { ...base, active } });
        onClose();
      } else {
        await create.mutateAsync(base);
        setSuccess(true);
      }
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a categoria.',
      );
    }
  }

  const footer = success ? (
    <Button variant="primary" className="w-full sm:w-auto" onClick={onClose}>
      Fechar
    </Button>
  ) : (
    <>
      <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
        Cancelar
      </Button>
      <Button
        variant="primary"
        className="w-full sm:w-auto"
        isDisabled={!canConfirm}
        onClick={handleConfirm}
      >
        {isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Editar categoria' : 'Categoria'}
      footer={footer}
      widthClass="sm:w-[480px]"
    >
      {success ? (
        <SuccessBlock text="Categoria criada com sucesso!" />
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Nome">
            <TextField value={name} onChange={setName} aria-label="Nome">
              <Input placeholder="Ex.: Vendas de serviços" />
            </TextField>
          </Field>

          <Field label="Crédito/Débito">
            <Select
              aria-label="Crédito/Débito"
              selectedKey={kind}
              onSelectionChange={(k) => setKind(String(k) as FinancialCategoryKind)}
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="credit" textValue="Crédito">
                    Crédito
                  </ListBox.Item>
                  <ListBox.Item id="debit" textValue="Débito">
                    Débito
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </Field>

          <RowSwitch
            label="Conta como comissão"
            isSelected={countsAsCommission}
            onChange={setCountsAsCommission}
          />
          <RowSwitch label="Ativa" isSelected={active} onChange={setActive} />

          {formError && <FormError message={formError} />}
        </div>
      )}
    </Drawer>
  );
}

function SuccessBlock({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-3xl text-gold-strong">
        ✓
      </div>
      <p className="text-base font-semibold text-foreground">{text}</p>
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}
