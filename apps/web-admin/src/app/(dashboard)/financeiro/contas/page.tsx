'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  Input,
  ListBox,
  Modal,
  Select,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState, LoadingState } from '@/components/States';
import { ActiveChip } from '@/components/StatusChip';
import { IconCreditCard, IconFolder, IconPlus } from '@/components/icons';
import { formatMoney } from '@/lib/format';
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
} from '@/lib/queries/financeiro';

const ACCOUNT_TYPE_LABEL: Record<FinancialAccountType, string> = {
  cash: 'Dinheiro',
  bank: 'Banco',
};

const CATEGORY_KIND_LABEL: Record<FinancialCategoryKind, string> = {
  credit: 'Entrada',
  debit: 'Saída',
};

export default function ContasPage() {
  const [accountModal, setAccountModal] = useState(false);
  const [methodModal, setMethodModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);

  const accounts = useFinancialAccounts();
  const methods = usePaymentMethods();
  const categories = useFinancialCategories();

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
      window.alert(
        err instanceof ApiClientError ? err.message : 'Não foi possível remover a conta.',
      );
    }
  }
  async function removeMethod(m: PaymentMethod) {
    if (!window.confirm(`Remover a forma "${m.name}"?`)) return;
    try {
      await delMethod.mutateAsync(m.id);
    } catch (err) {
      window.alert(
        err instanceof ApiClientError ? err.message : 'Não foi possível remover a forma.',
      );
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
      header: 'Conta',
      isRowHeader: true,
      render: (a) => <span className="font-medium text-foreground">{a.name}</span>,
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (a) => (
        <Chip variant="soft" color="accent" size="sm">
          {ACCOUNT_TYPE_LABEL[a.type]}
        </Chip>
      ),
    },
    {
      key: 'initial',
      header: 'Saldo inicial',
      render: (a) => formatMoney(a.initialBalance),
    },
    { key: 'active', header: 'Status', render: (a) => <ActiveChip active={a.active} /> },
    {
      key: 'actions',
      header: 'Ações',
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
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            isDisabled={delAccount.isPending}
            onClick={() => removeAccount(a)}
          >
            Remover
          </Button>
        </div>
      ),
    },
  ];

  const methodColumns: Column<PaymentMethod>[] = [
    {
      key: 'name',
      header: 'Forma',
      isRowHeader: true,
      render: (m) => <span className="font-medium text-foreground">{m.name}</span>,
    },
    {
      key: 'fee',
      header: 'Taxa',
      render: (m) => `${Number(m.feePercent).toFixed(2)}%`,
    },
    {
      key: 'settlement',
      header: 'Liquidação',
      render: (m) => `${m.settlementDays} dia(s)`,
    },
    {
      key: 'cash',
      header: 'Vai p/ caixa',
      render: (m) => (
        <Chip variant="soft" color={m.goesToCash ? 'success' : 'default'} size="sm">
          {m.goesToCash ? 'Sim' : 'Não'}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
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
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            isDisabled={delMethod.isPending}
            onClick={() => removeMethod(m)}
          >
            Remover
          </Button>
        </div>
      ),
    },
  ];

  const categoryColumns: Column<FinancialCategory>[] = [
    {
      key: 'name',
      header: 'Categoria',
      isRowHeader: true,
      render: (c) => <span className="font-medium text-foreground">{c.name}</span>,
    },
    {
      key: 'kind',
      header: 'Natureza',
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
      header: 'Ações',
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
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            isDisabled={delCategory.isPending}
            onClick={() => removeCategory(c)}
          >
            Remover
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Contas e formas de pagamento"
        subtitle="Contas financeiras, formas de pagamento e categorias"
      />

      {/* Contas financeiras */}
      <Card className="db-card mb-4">
        <Card.Content className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Contas financeiras</h3>
            <Button variant="primary" size="sm" onClick={openCreateAccount}>
              <IconPlus size={15} /> Nova conta
            </Button>
          </div>
          {accounts.isLoading ? (
            <LoadingState />
          ) : (accounts.data ?? []).length === 0 ? (
            <EmptyState
              icon={<IconFolder size={32} />}
              title="Nenhuma conta cadastrada"
              description="Cadastre caixa ou contas bancárias para registrar movimentações."
            />
          ) : (
            <DataTable
              aria-label="Contas financeiras"
              columns={accountColumns}
              rows={accounts.data ?? []}
              getKey={(a) => a.id}
            />
          )}
        </Card.Content>
      </Card>

      {/* Formas de pagamento */}
      <Card className="db-card mb-4">
        <Card.Content className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Formas de pagamento</h3>
            <Button variant="primary" size="sm" onClick={openCreateMethod}>
              <IconPlus size={15} /> Nova forma
            </Button>
          </div>
          {methods.isLoading ? (
            <LoadingState />
          ) : (methods.data ?? []).length === 0 ? (
            <EmptyState
              icon={<IconCreditCard size={32} />}
              title="Nenhuma forma de pagamento"
              description="Cadastre dinheiro, pix, crédito ou débito com taxa e liquidação."
            />
          ) : (
            <DataTable
              aria-label="Formas de pagamento"
              columns={methodColumns}
              rows={methods.data ?? []}
              getKey={(m) => m.id}
            />
          )}
        </Card.Content>
      </Card>

      {/* Categorias financeiras */}
      <Card className="db-card">
        <Card.Content className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Categorias financeiras</h3>
            <Button variant="primary" size="sm" onClick={openCreateCategory}>
              <IconPlus size={15} /> Nova categoria
            </Button>
          </div>
          {categories.isLoading ? (
            <LoadingState />
          ) : (categories.data ?? []).length === 0 ? (
            <EmptyState
              icon={<IconFolder size={32} />}
              title="Nenhuma categoria cadastrada"
              description="Organize receitas e despesas por categoria."
            />
          ) : (
            <DataTable
              aria-label="Categorias financeiras"
              columns={categoryColumns}
              rows={categories.data ?? []}
              getKey={(c) => c.id}
            />
          )}
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-foreground">
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
      } else {
        setName('');
        setType('cash');
        setInitialBalance('');
      }
      setFormError(null);
      setSuccess(false);
    }
  }, [isOpen, editing]);

  const canConfirm = name.trim().length >= 2 && !isPending;

  async function handleConfirm() {
    setFormError(null);
    const body = {
      name: name.trim(),
      type,
      initialBalance: initialBalance
        ? Number(initialBalance.replace(',', '.'))
        : undefined,
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
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a conta.',
      );
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={editing ? 'Editar conta financeira' : 'Nova conta financeira'}
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
              <ListBox.Item id="cash" textValue="Dinheiro">
                Dinheiro
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
        <TextField
          value={initialBalance}
          onChange={setInitialBalance}
          aria-label="Saldo inicial"
        >
          <Input placeholder="0,00" inputMode="decimal" />
        </TextField>
      </div>
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
          <label className="text-xs font-medium text-muted">Liquidação (dias)</label>
          <TextField
            value={settlementDays}
            onChange={setSettlementDays}
            aria-label="Liquidação"
          >
            <Input placeholder="0" inputMode="numeric" />
          </TextField>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Conta padrão</label>
        <Select
          aria-label="Conta padrão"
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
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={goesToCash}
          onChange={(e) => setGoesToCash(e.target.checked)}
        />
        Entra no caixa
      </label>
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
      } else {
        setName('');
        setKind('credit');
        setCountsAsCommission(false);
      }
      setFormError(null);
      setSuccess(false);
    }
  }, [isOpen, editing]);

  const canConfirm = name.trim().length >= 2 && !isPending;

  async function handleConfirm() {
    setFormError(null);
    const body = {
      name: name.trim(),
      kind,
      countsAsCommission,
      isExpense: kind === 'debit',
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
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a categoria.',
      );
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={editing ? 'Editar categoria financeira' : 'Nova categoria financeira'}
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
        <label className="text-xs font-medium text-muted">Natureza</label>
        <Select
          aria-label="Natureza"
          selectedKey={kind}
          onSelectionChange={(k) => setKind(String(k) as FinancialCategoryKind)}
        >
          <Select.Trigger>
            <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="credit" textValue="Entrada">
                Entrada
              </ListBox.Item>
              <ListBox.Item id="debit" textValue="Saída">
                Saída
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={countsAsCommission}
          onChange={(e) => setCountsAsCommission(e.target.checked)}
        />
        Conta como comissão
      </label>
    </ModalShell>
  );
}
