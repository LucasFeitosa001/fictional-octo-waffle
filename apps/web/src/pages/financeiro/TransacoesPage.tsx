import { useEffect, useMemo, useState } from 'react';
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
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  IconArrowDown,
  IconArrowUp,
  IconDollar,
  IconDownload,
  IconPencil,
  IconPlus,
  IconTrash,
  IconWallet,
} from '../../components/icons';
import { DateField, DateRangeFilter } from '../../components/DateRangeFilter';
import { formatDate, formatMoney, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useFinancialAccounts,
  useFinancialCategories,
  usePaymentMethods,
  useTransactions,
  useUpdateTransaction,
  type CreateTransactionBody,
  type PaymentStatus,
  type TransactionKind,
  type TransactionRow,
} from '../../lib/queries/financeiro';

const CARD_CLASS =
  'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

const ALL = '__all__';

const KIND_LABEL: Record<TransactionKind, string> = {
  income: 'Receita',
  expense: 'Despesa',
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  reversed: 'Estornado',
};

const STATUS_COLOR: Record<PaymentStatus, 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  paid: 'success',
  reversed: 'danger',
};

export function TransacoesPage() {
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionKind>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [accountFilter, setAccountFilter] = useState(ALL);
  const [methodFilter, setMethodFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);

  const accounts = useFinancialAccounts();
  const paymentMethods = usePaymentMethods();
  const categories = useFinancialCategories();

  // Server supports type/status/from/to. Account/method/category are filtered
  // client-side below since the API doesn't accept those params.
  const transactions = useTransactions({
    type: typeFilter === 'all' ? undefined : typeFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    from: from || undefined,
    to: to || undefined,
  });
  const del = useDeleteTransaction();

  const serverRows = transactions.data?.data ?? [];
  const rows = useMemo(
    () =>
      serverRows.filter(
        (t) =>
          (accountFilter === ALL || t.accountId === accountFilter) &&
          (methodFilter === ALL || t.paymentMethodId === methodFilter) &&
          (categoryFilter === ALL || t.categoryId === categoryFilter),
      ),
    [serverRows, accountFilter, methodFilter, categoryFilter],
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of rows) {
      const v = Number(t.grossAmount) || 0;
      if (t.kind === 'income') income += v;
      else expense += v;
    }
    return { income, expense, balance: income - expense };
  }, [rows]);

  const hasFilters =
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    Boolean(from) ||
    Boolean(to) ||
    accountFilter !== ALL ||
    methodFilter !== ALL ||
    categoryFilter !== ALL;

  function clearFilters() {
    setTypeFilter('all');
    setStatusFilter('all');
    setFrom('');
    setTo('');
    setAccountFilter(ALL);
    setMethodFilter(ALL);
    setCategoryFilter(ALL);
  }

  function exportCsv() {
    downloadCsv<TransactionRow>(
      `transacoes-${isoDate(new Date())}`,
      [
        { header: 'Descrição', value: (t) => t.description ?? '' },
        { header: 'Tipo', value: (t) => KIND_LABEL[t.kind] },
        { header: 'Categoria', value: (t) => t.category?.name ?? '' },
        { header: 'Forma', value: (t) => t.paymentMethod?.name ?? '' },
        { header: 'Conta', value: (t) => t.account?.name ?? '' },
        { header: 'Valor', value: (t) => Number(t.grossAmount).toFixed(2) },
        { header: 'Vencimento', value: (t) => t.dueDate ?? '' },
        { header: 'Status', value: (t) => STATUS_LABEL[t.status] },
      ],
      rows,
    );
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(t: TransactionRow) {
    setEditing(t);
    setModalOpen(true);
  }
  async function handleRemove(t: TransactionRow) {
    if (!window.confirm('Remover esta transação?')) return;
    try {
      await del.mutateAsync(t.id);
    } catch {
      window.alert('Não foi possível remover a transação.');
    }
  }

  const columns: Column<TransactionRow>[] = [
    {
      key: 'description',
      header: 'Descrição',
      isRowHeader: true,
      render: (t) => (
        <span className="font-medium text-foreground">
          {t.description ?? '—'}
        </span>
      ),
    },
    {
      key: 'kind',
      header: 'Tipo',
      render: (t) => (
        <Chip
          variant="soft"
          color={t.kind === 'income' ? 'success' : 'danger'}
          size="sm"
        >
          {KIND_LABEL[t.kind]}
        </Chip>
      ),
    },
    {
      key: 'category',
      header: 'Categoria',
      render: (t) =>
        t.category ? (
          <Chip variant="soft" color="accent" size="sm">
            {t.category.name}
          </Chip>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'method',
      header: 'Forma',
      render: (t) => t.paymentMethod?.name ?? '—',
    },
    {
      key: 'amount',
      header: 'Valor',
      render: (t) => (
        <span
          className={
            t.kind === 'income' ? 'font-semibold text-success' : 'font-semibold text-danger'
          }
        >
          {formatMoney(t.grossAmount)}
        </span>
      ),
    },
    { key: 'due', header: 'Vencimento', render: (t) => formatDate(t.dueDate) },
    {
      key: 'status',
      header: 'Status',
      render: (t) => (
        <Chip variant="soft" color={STATUS_COLOR[t.status]} size="sm">
          {STATUS_LABEL[t.status]}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (t) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
            <IconPencil size={15} /> Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            isDisabled={del.isPending}
            onClick={() => handleRemove(t)}
          >
            <IconTrash size={15} /> Remover
          </Button>
        </div>
      ),
    },
  ];

  const typeSegments: { id: 'all' | TransactionKind; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'income', label: 'Receitas' },
    { id: 'expense', label: 'Despesas' },
  ];

  return (
    <div>
      <PageHeader
        title="Transações"
        subtitle="Lançamentos de receitas e despesas"
        onRefresh={() => transactions.refetch()}
        isRefreshing={transactions.isFetching}
        actions={
          <>
            <Button
              variant="outline"
              onClick={exportCsv}
              isDisabled={rows.length === 0}
            >
              <IconDownload size={16} /> Exportar CSV
            </Button>
            <Button variant="primary" onClick={openCreate}>
              <IconPlus size={16} /> Nova transação
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <Card className={`mb-4 ${CARD_CLASS}`}>
        <Card.Content className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <DateRangeFilter
              from={from}
              to={to}
              onChange={({ from: f, to: t }) => {
                setFrom(f);
                setTo(t);
              }}
            />
            {/* Type segmented control */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">Tipo</span>
              <div className="inline-flex h-10 items-center gap-1 rounded-lg border border-[var(--color-soft-border)] bg-white p-1">
                {typeSegments.map((s) => {
                  const active = typeFilter === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setTypeFilter(s.id)}
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
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as 'all' | PaymentStatus)}
              options={[
                { id: 'all', name: 'Todos os status' },
                { id: 'paid', name: 'Pago' },
                { id: 'pending', name: 'Pendente' },
                { id: 'reversed', name: 'Estornado' },
              ]}
            />
            <FilterSelect
              label="Conta"
              value={accountFilter}
              onChange={setAccountFilter}
              options={[
                { id: ALL, name: 'Todas as contas' },
                ...(accounts.data ?? []).map((a) => ({ id: a.id, name: a.name })),
              ]}
            />
            <FilterSelect
              label="Forma de pagamento"
              value={methodFilter}
              onChange={setMethodFilter}
              options={[
                { id: ALL, name: 'Todas as formas' },
                ...(paymentMethods.data ?? []).map((m) => ({ id: m.id, name: m.name })),
              ]}
            />
            <FilterSelect
              label="Categoria"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { id: ALL, name: 'Todas as categorias' },
                ...(categories.data ?? []).map((c) => ({ id: c.id, name: c.name })),
              ]}
            />
          </div>

          {hasFilters && (
            <div>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Totals strip */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TotalCard
          icon={<IconArrowUp size={16} />}
          label="Receitas"
          value={formatMoney(totals.income)}
          tone="success"
        />
        <TotalCard
          icon={<IconArrowDown size={16} />}
          label="Despesas"
          value={formatMoney(totals.expense)}
          tone="danger"
        />
        <TotalCard
          icon={<IconWallet size={16} />}
          label="Saldo filtrado"
          value={formatMoney(totals.balance)}
          tone="accent"
        />
      </div>

      <Card className={CARD_CLASS}>
        <Card.Content className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Lançamentos</h3>
            <span className="text-xs text-muted">
              {rows.length} resultado(s)
            </span>
          </div>
          {transactions.isLoading ? (
            <LoadingState />
          ) : transactions.isError ? (
            <ErrorState onRetry={() => transactions.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconDollar size={32} />}
              title={
                hasFilters
                  ? 'Nenhuma transação para os filtros'
                  : 'Nenhuma transação registrada'
              }
              description={
                hasFilters
                  ? 'Ajuste os filtros para ver mais lançamentos.'
                  : 'Lance receitas e despesas para acompanhar o caixa.'
              }
            />
          ) : (
            <DataTable
              aria-label="Transações"
              columns={columns}
              rows={rows}
              getKey={(t) => t.id}
            />
          )}
        </Card.Content>
      </Card>

      <NovaTransacaoModal isOpen={modalOpen} onOpenChange={setModalOpen} editing={editing} />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <Select
        aria-label={label}
        selectedKey={value}
        onSelectionChange={(k) => onChange(String(k))}
      >
        <Select.Trigger>
          <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map((o) => (
              <ListBox.Item key={o.id} id={o.id} textValue={o.name}>
                {o.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}

function TotalCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'success' | 'danger' | 'accent';
}) {
  const toneText =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : 'text-foreground';
  const iconWrap =
    tone === 'success'
      ? 'bg-success/12 text-success'
      : tone === 'danger'
        ? 'bg-danger/12 text-danger'
        : 'bg-[#f2b33d]/15 text-[#a67c1e]';
  return (
    <Card className={CARD_CLASS}>
      <Card.Content className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${iconWrap}`}>
            {icon}
          </span>
          <span className="text-sm font-medium text-muted">{label}</span>
        </div>
        <span className={`text-lg font-bold ${toneText}`}>{value}</span>
      </Card.Content>
    </Card>
  );
}

const NONE = '';

function NovaTransacaoModal({
  isOpen,
  onOpenChange,
  editing,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editing: TransactionRow | null;
}) {
  const [kind, setKind] = useState<TransactionKind>('income');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState<PaymentStatus>('paid');
  const [dueDate, setDueDate] = useState(() => isoDate(new Date()));
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const categories = useFinancialCategories();
  const paymentMethods = usePaymentMethods();
  const accounts = useFinancialAccounts();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setKind(editing.kind);
        setAmount(String(editing.grossAmount));
        setDescription(editing.description ?? '');
        setCategoryId(editing.categoryId ?? '');
        setPaymentMethodId(editing.paymentMethodId ?? '');
        setAccountId(editing.accountId ?? '');
        setStatus(editing.status);
        setDueDate(editing.dueDate ? isoDate(new Date(editing.dueDate)) : isoDate(new Date()));
      } else {
        setKind('income');
        setAmount('');
        setDescription('');
        setCategoryId('');
        setPaymentMethodId('');
        setAccountId('');
        setStatus('paid');
        setDueDate(isoDate(new Date()));
      }
      setFormError(null);
      setSuccess(false);
    }
  }, [isOpen, editing]);

  const isPending = createTransaction.isPending || updateTransaction.isPending;
  const numericAmount = useMemo(() => Number(amount.replace(',', '.')), [amount]);
  const canConfirm = Number.isFinite(numericAmount) && numericAmount > 0 && !isPending;

  async function handleConfirm() {
    setFormError(null);
    if (!canConfirm) {
      setFormError('Informe um valor válido.');
      return;
    }
    const body: CreateTransactionBody = {
      kind,
      grossAmount: numericAmount,
      status,
      dueDate,
      ...(status === 'paid' ? { paidAt: new Date().toISOString() } : {}),
      description: description.trim() || undefined,
      categoryId: categoryId || undefined,
      paymentMethodId: paymentMethodId || undefined,
      accountId: accountId || undefined,
    };
    try {
      if (editing) {
        await updateTransaction.mutateAsync({ id: editing.id, body });
        onOpenChange(false);
      } else {
        await createTransaction.mutateAsync(body);
        setSuccess(true);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message || 'Não foi possível salvar a transação.');
        return;
      }
      setFormError('Não foi possível salvar a transação. Tente novamente.');
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
      <Modal.Container
        placement="center"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{editing ? 'Editar transação' : 'Nova transação'}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {success ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f2b33d]/15 text-2xl text-[#a67c1e]">
                  ✓
                </div>
                <p className="text-base font-semibold text-foreground">
                  Transação registrada com sucesso!
                </p>
              </div>
            ) : (
              <>
                {/* Tipo */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Tipo</label>
                  <div className="flex gap-2">
                    {(['income', 'expense'] as TransactionKind[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKind(k)}
                        className={
                          'flex-1 rounded-md border px-3 py-2 text-sm transition-colors ' +
                          (kind === k
                            ? 'border-[#f2b33d] bg-[#f2b33d] text-[#111111] shadow-[var(--shadow-gold)]'
                            : 'border-default-200 text-foreground hover:border-[#f2b33d]')
                        }
                      >
                        {KIND_LABEL[k]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Valor */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Valor (R$)</label>
                  <TextField value={amount} onChange={setAmount} aria-label="Valor">
                    <Input placeholder="0,00" inputMode="decimal" />
                  </TextField>
                </div>

                {/* Descrição */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Descrição</label>
                  <TextField
                    value={description}
                    onChange={setDescription}
                    aria-label="Descrição"
                  >
                    <Input placeholder="Ex.: Pagamento de fornecedor" />
                  </TextField>
                </div>

                {/* Categoria */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Categoria</label>
                  <Select
                    aria-label="Categoria"
                    selectedKey={categoryId || null}
                    onSelectionChange={(k) => setCategoryId(k ? String(k) : NONE)}
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
                        {(categories.data ?? []).map((c) => (
                          <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                            {c.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                {/* Forma de pagamento */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">
                    Forma de pagamento
                  </label>
                  <Select
                    aria-label="Forma de pagamento"
                    selectedKey={paymentMethodId || null}
                    onSelectionChange={(k) => setPaymentMethodId(k ? String(k) : NONE)}
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
                        {(paymentMethods.data ?? []).map((m) => (
                          <ListBox.Item key={m.id} id={m.id} textValue={m.name}>
                            {m.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                {/* Conta */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Conta</label>
                  <Select
                    aria-label="Conta"
                    selectedKey={accountId || null}
                    onSelectionChange={(k) => setAccountId(k ? String(k) : NONE)}
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

                {/* Vencimento + Status */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <DateField
                    label="Vencimento"
                    value={dueDate}
                    onChange={setDueDate}
                    className="min-w-0"
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted">Status</label>
                    <Select
                      aria-label="Status"
                      selectedKey={status}
                      onSelectionChange={(k) => setStatus(String(k) as PaymentStatus)}
                    >
                      <Select.Trigger>
                        <Select.Value>
                          {({ selectedText }) => selectedText}
                        </Select.Value>
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="paid" textValue="Pago">
                            Pago
                          </ListBox.Item>
                          <ListBox.Item id="pending" textValue="Pendente">
                            Pendente
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                </div>

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
                  onClick={handleConfirm}
                >
                  {isPending ? 'Salvando…' : 'Salvar transação'}
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
