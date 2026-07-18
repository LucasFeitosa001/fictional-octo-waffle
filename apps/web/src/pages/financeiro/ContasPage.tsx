import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  Input,
  ListBox,
  Modal,
  Select,
  Switch,
  Tabs,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, LoadingState } from '../../components/States';
import { ActiveChip } from '../../components/StatusChip';
import {
  IconCreditCard,
  IconFolder,
  IconPencil,
  IconPlus,
  IconTrash,
  IconWallet,
} from '../../components/icons';
import { formatMoney } from '../../lib/format';

const CARD_CLASS =
  'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';
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

const ACCOUNT_TYPE_LABEL: Record<FinancialAccountType, string> = {
  cash: 'Caixa',
  bank: 'Banco',
};

const CATEGORY_KIND_LABEL: Record<FinancialCategoryKind, string> = {
  credit: 'Crédito',
  debit: 'Débito',
};

type TabKey = 'contas' | 'formas' | 'categorias';
type StatusFilter = 'all' | 'active' | 'inactive';

function StatusSeg({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  return (
    <div className="inline-flex h-10 items-center gap-1 rounded-lg border border-[var(--color-soft-border)] bg-white p-1">
      {(
        [
          { id: 'all', label: 'Todos' },
          { id: 'active', label: 'Ativados' },
          { id: 'inactive', label: 'Desativados' },
        ] as const
      ).map((s) => {
        const active = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
              (active
                ? 'bg-[#f2b33d] text-[#111111] shadow-[var(--shadow-gold)]'
                : 'text-muted hover:text-foreground')
            }
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function ContasPage() {
  const [tab, setTab] = useState<TabKey>('contas');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [accountModal, setAccountModal] = useState(false);
  const [methodModal, setMethodModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
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
    return (
      statusFilter === 'all' ||
      (statusFilter === 'active' && active) ||
      (statusFilter === 'inactive' && !active)
    );
  }

  // Status filter só se aplica onde o backend expõe `active` (contas e categorias).
  const supportsStatus = tab !== 'formas';

  const filteredAccounts = useMemo(
    () => allAccounts.filter((a) => matchActive(a.active) && matchSearch(a.name)),
    [allAccounts, statusFilter, q],
  );
  const filteredCategories = useMemo(
    () => allCategories.filter((c) => matchActive(c.active) && matchSearch(c.name)),
    [allCategories, statusFilter, q],
  );
  const filteredMethods = useMemo(
    () => allMethods.filter((m) => matchSearch(m.name)),
    [allMethods, q],
  );

  const totalBalance = useMemo(
    () =>
      allAccounts
        .filter((a) => a.active)
        .reduce((sum, a) => sum + (Number(a.initialBalance) || 0), 0),
    [allAccounts],
  );
  const activeAccountCount = allAccounts.filter((a) => a.active).length;

  const delAccount = useDeleteFinancialAccount();
  const delMethod = useDeletePaymentMethod();
  const delCategory = useDeleteFinancialCategory();

  function openCreateAccount() {
    setEditingAccount(null);
    setAccountModal(true);
  }
  function openCreateMethod() {
    setEditingMethod(null);
    setMethodModal(true);
  }
  function openCreateCategory() {
    setEditingCategory(null);
    setCategoryModal(true);
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
      render: (a) => <span className="font-medium text-foreground">{a.name}</span>,
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
      key: 'initial',
      header: 'Saldo',
      render: (a) => formatMoney(a.initialBalance),
    },
    { key: 'active', header: 'Status', render: (a) => <ActiveChip active={a.active} /> },
    {
      key: 'actions',
      header: '',
      render: (a) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingAccount(a);
              setAccountModal(true);
            }}
          >
            <IconPencil size={15} /> Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            isDisabled={delAccount.isPending}
            onClick={() => removeAccount(a)}
          >
            <IconTrash size={15} /> Remover
          </Button>
        </div>
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
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingMethod(m);
              setMethodModal(true);
            }}
          >
            <IconPencil size={15} /> Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            isDisabled={delMethod.isPending}
            onClick={() => removeMethod(m)}
          >
            <IconTrash size={15} /> Remover
          </Button>
        </div>
      ),
    },
  ];

  const categoryColumns: Column<FinancialCategory>[] = [
    {
      key: 'name',
      header: 'Nome',
      isRowHeader: true,
      render: (c) => <span className="font-medium text-foreground">{c.name}</span>,
    },
    {
      key: 'kind',
      header: 'Crédito/Débito',
      render: (c) => (
        <Chip
          variant="soft"
          color={c.kind === 'credit' ? 'success' : 'danger'}
          size="sm"
        >
          {CATEGORY_KIND_LABEL[c.kind]}
        </Chip>
      ),
    },
    {
      key: 'commission',
      header: 'Comissionável',
      render: (c) => (c.countsAsCommission ? 'Sim' : 'Não'),
    },
    { key: 'active', header: 'Status', render: (c) => <ActiveChip active={c.active} /> },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingCategory(c);
              setCategoryModal(true);
            }}
          >
            <IconPencil size={15} /> Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            isDisabled={delCategory.isPending}
            onClick={() => removeCategory(c)}
          >
            <IconTrash size={15} /> Remover
          </Button>
        </div>
      ),
    },
  ];

  const searchPlaceholder =
    tab === 'contas'
      ? 'Buscar conta…'
      : tab === 'formas'
        ? 'Buscar forma de pagamento…'
        : 'Buscar categoria…';

  const onNew =
    tab === 'contas'
      ? openCreateAccount
      : tab === 'formas'
        ? openCreateMethod
        : openCreateCategory;

  const newLabel =
    tab === 'contas' ? 'Nova conta' : tab === 'formas' ? 'Nova forma' : 'Nova categoria';

  return (
    <div>
      <PageHeader
        title="Cadastros financeiros"
        subtitle="Contas, formas de pagamento e categorias"
        onRefresh={() => {
          accounts.refetch();
          methods.refetch();
          categories.refetch();
        }}
        isRefreshing={accounts.isFetching || methods.isFetching || categories.isFetching}
      />

      {/* Summary header */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className={CARD_CLASS}>
          <Card.Content className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
                <IconWallet size={16} />
              </span>
              <span className="text-sm font-medium text-muted">Saldo inicial total</span>
            </div>
            <span className="text-lg font-bold text-foreground">
              {formatMoney(totalBalance)}
            </span>
          </Card.Content>
        </Card>
        <Card className={CARD_CLASS}>
          <Card.Content className="flex items-center justify-between p-4">
            <span className="text-sm font-medium text-muted">Contas ativas</span>
            <span className="text-lg font-bold text-foreground">
              {activeAccountCount}
            </span>
          </Card.Content>
        </Card>
        <Card className={CARD_CLASS}>
          <Card.Content className="flex items-center justify-between p-4">
            <span className="text-sm font-medium text-muted">Formas de pagamento</span>
            <span className="text-lg font-bold text-foreground">{allMethods.length}</span>
          </Card.Content>
        </Card>
      </div>

      <Card className={CARD_CLASS}>
        <Card.Content className="p-4">
          <Tabs
            selectedKey={tab}
            onSelectionChange={(k) => {
              setTab(String(k) as TabKey);
              setSearch('');
              setStatusFilter('all');
            }}
          >
            <Tabs.List className="w-full overflow-x-auto">
              <Tabs.Tab id="contas">Contas</Tabs.Tab>
              <Tabs.Tab id="formas">Formas de pagamento</Tabs.Tab>
              <Tabs.Tab id="categorias">Categorias</Tabs.Tab>
            </Tabs.List>

            {/* Toolbar: busca + filtrar por aba + novo */}
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <TextField
                  value={search}
                  onChange={setSearch}
                  className="min-w-0 flex-1 sm:max-w-xs"
                  aria-label="Buscar"
                >
                  <Input placeholder={searchPlaceholder} />
                </TextField>
                {supportsStatus && (
                  <StatusSeg value={statusFilter} onChange={setStatusFilter} />
                )}
                <div className="ms-auto">
                  <Button variant="primary" size="sm" onClick={onNew}>
                    <IconPlus size={15} /> {newLabel}
                  </Button>
                </div>
              </div>
            </div>

            <Tabs.Panel id="contas" className="pt-4">
              {accounts.isLoading ? (
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
                  rows={filteredAccounts}
                  getKey={(a) => a.id}
                />
              )}
            </Tabs.Panel>

            <Tabs.Panel id="formas" className="pt-4">
              {methods.isLoading ? (
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
                  rows={filteredMethods}
                  getKey={(m) => m.id}
                />
              )}
            </Tabs.Panel>

            <Tabs.Panel id="categorias" className="pt-4">
              {categories.isLoading ? (
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
                  rows={filteredCategories}
                  getKey={(c) => c.id}
                />
              )}
            </Tabs.Panel>
          </Tabs>
        </Card.Content>
      </Card>

      <NovaContaModal
        isOpen={accountModal}
        onOpenChange={setAccountModal}
        editing={editingAccount}
      />
      <NovaFormaModal isOpen={methodModal} onOpenChange={setMethodModal} editing={editingMethod} />
      <NovaCategoriaModal
        isOpen={categoryModal}
        onOpenChange={setCategoryModal}
        editing={editingCategory}
      />
    </div>
  );
}

function ModalShell({
  isOpen,
  onOpenChange,
  title,
  success,
  successText,
  canConfirm,
  isPending,
  formError,
  onConfirm,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  success: boolean;
  successText: string;
  canConfirm: boolean;
  isPending: boolean;
  formError: string | null;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
      <Modal.Container
        placement="center"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {success ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f2b33d]/15 text-2xl text-[#a67c1e]">
                  ✓
                </div>
                <p className="text-base font-semibold text-foreground">{successText}</p>
              </div>
            ) : (
              <>
                {children}
                {formError && (
                  <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {formError}
                  </div>
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {success ? (
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  className="w-full sm:w-auto"
                  isDisabled={!canConfirm}
                  onClick={onConfirm}
                >
                  {isPending ? 'Salvando…' : 'Salvar'}
                </Button>
              </>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

const NONE = '';

function NovaContaModal({
  isOpen,
  onOpenChange,
  editing,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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
        onOpenChange(false);
      } else {
        await create.mutateAsync(base);
        setSuccess(true);
      }
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a conta.',
      );
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={editing ? 'Editar conta' : 'Nova conta'}
      success={success}
      successText="Conta criada com sucesso!"
      canConfirm={canConfirm}
      isPending={isPending}
      formError={formError}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Nome</label>
        <TextField value={name} onChange={setName} aria-label="Nome">
          <Input placeholder="Ex.: Caixa principal" />
        </TextField>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Tipo</label>
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
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Saldo inicial (R$)</label>
        <TextField value={initialBalance} onChange={setInitialBalance} aria-label="Saldo inicial">
          <Input placeholder="0,00" inputMode="decimal" />
        </TextField>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Acesso</label>
        <div className="rounded-md border border-[var(--color-soft-border)] bg-white px-3 py-2 text-sm text-foreground">
          Qualquer usuário pode acessar
        </div>
      </div>
      <Switch
        isSelected={active}
        onChange={setActive}
        className="flex w-full items-center justify-between gap-3 py-1.5"
      >
        <span className="text-sm text-foreground">Ativa</span>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </ModalShell>
  );
}

function NovaFormaModal({
  isOpen,
  onOpenChange,
  editing,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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
        onOpenChange(false);
      } else {
        await create.mutateAsync(body);
        setSuccess(true);
      }
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a forma.',
      );
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={editing ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}
      success={success}
      successText="Forma criada com sucesso!"
      canConfirm={canConfirm}
      isPending={isPending}
      formError={formError}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Nome</label>
        <TextField value={name} onChange={setName} aria-label="Nome">
          <Input placeholder="Ex.: Cartão de crédito" />
        </TextField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Taxa (%)</label>
          <TextField value={feePercent} onChange={setFeePercent} aria-label="Taxa">
            <Input placeholder="0,00" inputMode="decimal" />
          </TextField>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Prazo de recebimento (dias)</label>
          <TextField
            value={settlementDays}
            onChange={setSettlementDays}
            aria-label="Prazo de recebimento"
          >
            <Input placeholder="0" inputMode="numeric" />
          </TextField>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Conta</label>
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
      </div>
      <Switch
        isSelected={goesToCash}
        onChange={setGoesToCash}
        className="flex w-full items-center justify-between gap-3 py-1.5"
      >
        <span className="text-sm text-foreground">
          Baixa automática no financeiro
        </span>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </ModalShell>
  );
}

function NovaCategoriaModal({
  isOpen,
  onOpenChange,
  editing,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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
        onOpenChange(false);
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

  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={editing ? 'Editar categoria' : 'Nova categoria'}
      success={success}
      successText="Categoria criada com sucesso!"
      canConfirm={canConfirm}
      isPending={isPending}
      formError={formError}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Nome</label>
        <TextField value={name} onChange={setName} aria-label="Nome">
          <Input placeholder="Ex.: Vendas de serviços" />
        </TextField>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Crédito/Débito</label>
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
      </div>
      <Switch
        isSelected={countsAsCommission}
        onChange={setCountsAsCommission}
        className="flex w-full items-center justify-between gap-3 py-1.5"
      >
        <span className="text-sm text-foreground">Conta como comissão</span>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
      <Switch
        isSelected={active}
        onChange={setActive}
        className="flex w-full items-center justify-between gap-3 py-1.5"
      >
        <span className="text-sm text-foreground">Ativa</span>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </ModalShell>
  );
}
