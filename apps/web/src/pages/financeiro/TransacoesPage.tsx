import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  Dropdown,
  Input,
  ListBox,
  Modal,
  Select,
  Switch,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  IconArrowDown,
  IconArrowUp,
  IconChevron,
  IconDollar,
  IconDownload,
  IconPencil,
  IconPlus,
  IconRepeat,
  IconWallet,
} from '../../components/icons';
import { DateField, DateRangeFilter } from '../../components/DateRangeFilter';
import { formatDate, formatMoney, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useCustomers, useProfessionals } from '../../lib/queries';
import {
  useCreateTransaction,
  useCreateTransfer,
  useFinancialAccounts,
  useFinancialCategories,
  usePaymentMethods,
  useReverseTransaction,
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

/** Tipo de lançamento (UI). Vale = despesa p/ profissional; Transferência = par. */
type LancamentoMode = 'recebimento' | 'despesa' | 'vale' | 'transferencia';

const MODE_LABEL: Record<LancamentoMode, string> = {
  recebimento: 'Recebimento',
  despesa: 'Despesa',
  vale: 'Vale',
  transferencia: 'Transferência',
};

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

/** Descrição automática referenciando comanda/cliente quando houver. */
function describe(t: TransactionRow): string {
  if (t.description && t.description.trim()) return t.description.trim();
  if (t.order) {
    const who = t.order.customer?.name;
    return who
      ? `Referente à comanda #${t.order.number} para ${who}`
      : `Referente à comanda #${t.order.number}`;
  }
  return t.kind === 'income' ? 'Recebimento' : 'Despesa';
}

export function TransacoesPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>(
    'all',
  );
  const [showReversed, setShowReversed] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [methodFilter, setMethodFilter] = useState(ALL);
  const [formMode, setFormMode] = useState<LancamentoMode | null>(null);
  const [editing, setEditing] = useState<TransactionRow | null>(null);

  const paymentMethods = usePaymentMethods();

  const transactions = useTransactions({
    status: statusFilter === 'all' ? undefined : statusFilter,
    paymentMethodId: methodFilter === ALL ? undefined : methodFilter,
    from: from || undefined,
    to: to || undefined,
  });
  const reverse = useReverseTransaction();

  const serverRows = transactions.data?.data ?? [];
  const rows = useMemo(
    () =>
      serverRows.filter((t) => showReversed || t.status !== 'reversed'),
    [serverRows, showReversed],
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of rows) {
      if (t.status === 'reversed') continue;
      const v = Number(t.grossAmount) || 0;
      if (t.kind === 'income') income += v;
      else expense += v;
    }
    return { income, expense, balance: income - expense };
  }, [rows]);

  const hasFilters =
    statusFilter !== 'all' ||
    showReversed ||
    Boolean(from) ||
    Boolean(to) ||
    methodFilter !== ALL;

  function clearFilters() {
    setStatusFilter('all');
    setShowReversed(false);
    setFrom('');
    setTo('');
    setMethodFilter(ALL);
  }

  function exportCsv() {
    downloadCsv<TransactionRow>(
      `transacoes-${isoDate(new Date())}`,
      [
        { header: 'Descrição', value: (t) => describe(t) },
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

  function openForm(mode: LancamentoMode) {
    setEditing(null);
    setFormMode(mode);
  }
  function openEdit(t: TransactionRow) {
    setEditing(t);
    setFormMode(t.kind === 'income' ? 'recebimento' : 'despesa');
  }
  function closeForm() {
    setFormMode(null);
    setEditing(null);
  }

  async function handleReverse(t: TransactionRow) {
    if (
      !window.confirm(
        'Estornar esta transação? A original será preservada e marcada como estornada.',
      )
    )
      return;
    try {
      await reverse.mutateAsync(t.id);
    } catch (err) {
      window.alert(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível estornar a transação.',
      );
    }
  }

  return (
    <div>
      <PageHeader
        title="Transações"
        subtitle="Recebimentos, despesas, vales e transferências"
        actions={
          <>
            <Button
              variant="outline"
              onClick={exportCsv}
              isDisabled={rows.length === 0}
            >
              <IconDownload size={16} /> Exportar CSV
            </Button>
            <Dropdown>
              <Dropdown.Trigger>
                <Button variant="primary">
                  <IconPlus size={16} /> Novo <IconChevron size={14} />
                </Button>
              </Dropdown.Trigger>
              <Dropdown.Popover>
                <Dropdown.Menu aria-label="Tipo de lançamento">
                  <Dropdown.Item
                    textValue="Recebimento"
                    onAction={() => openForm('recebimento')}
                  >
                    Recebimento
                  </Dropdown.Item>
                  <Dropdown.Item
                    textValue="Despesa"
                    onAction={() => openForm('despesa')}
                  >
                    Despesa
                  </Dropdown.Item>
                  <Dropdown.Item textValue="Vale" onAction={() => openForm('vale')}>
                    Vale
                  </Dropdown.Item>
                  <Dropdown.Item
                    textValue="Transferência"
                    onAction={() => openForm('transferencia')}
                  >
                    Transferência
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
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
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FilterSelect
              label="Status de pagamento"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as 'all' | 'paid' | 'pending')}
              options={[
                { id: 'all', name: 'Todos' },
                { id: 'paid', name: 'Pago' },
                { id: 'pending', name: 'Pendente' },
              ]}
            />
            <FilterSelect
              label="Forma de pagamento"
              value={methodFilter}
              onChange={setMethodFilter}
              options={[
                { id: ALL, name: 'Todas as formas' },
                ...(paymentMethods.data ?? []).map((m) => ({
                  id: m.id,
                  name: m.name,
                })),
              ]}
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">Estornadas</span>
              <Switch
                isSelected={showReversed}
                onChange={setShowReversed}
                className="flex h-10 items-center justify-between gap-3 rounded-lg border border-[var(--color-soft-border)] bg-white px-3"
              >
                <span className="text-sm text-foreground">
                  Mostrar estornadas
                </span>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
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
            <span className="text-xs text-muted">{rows.length} resultado(s)</span>
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
                  : 'Lance recebimentos e despesas para acompanhar o caixa.'
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((t) => (
                <TransactionItem
                  key={t.id}
                  t={t}
                  onEdit={() => openEdit(t)}
                  onReverse={() => handleReverse(t)}
                  reversing={reverse.isPending}
                />
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>

      {formMode === 'transferencia' ? (
        <TransferenciaModal isOpen onClose={closeForm} />
      ) : formMode ? (
        <LancamentoModal
          mode={formMode}
          editing={editing}
          onClose={closeForm}
        />
      ) : null}
    </div>
  );
}

/** Item de transação com fundo tingido pela natureza (receita verde / despesa rosa). */
function TransactionItem({
  t,
  onEdit,
  onReverse,
  reversing,
}: {
  t: TransactionRow;
  onEdit: () => void;
  onReverse: () => void;
  reversing: boolean;
}) {
  const isReversed = t.status === 'reversed';
  const tint =
    t.kind === 'income'
      ? 'border-success/20 bg-success/5'
      : 'border-danger/20 bg-danger/5';
  return (
    <li
      className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${tint} ${
        isReversed ? 'opacity-60' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium text-foreground ${
            isReversed ? 'line-through' : ''
          }`}
        >
          {describe(t)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{formatDate(t.dueDate)}</span>
          {t.category && (
            <Chip variant="soft" color="accent" size="sm">
              {t.category.name}
            </Chip>
          )}
          {t.paymentMethod && <span>· {t.paymentMethod.name}</span>}
          {t.account && <span>· {t.account.name}</span>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="flex flex-col items-start sm:items-end">
          <span
            className={
              t.kind === 'income'
                ? 'text-sm font-semibold text-success'
                : 'text-sm font-semibold text-danger'
            }
          >
            {t.kind === 'income' ? '+' : '−'}
            {formatMoney(t.grossAmount)}
          </span>
          <Chip variant="soft" color={STATUS_COLOR[t.status]} size="sm">
            {STATUS_LABEL[t.status]}
          </Chip>
        </div>
        <div className="flex gap-2">
          {!isReversed && (
            <>
              <Button variant="outline" size="sm" onClick={onEdit}>
                <IconPencil size={15} /> Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                isDisabled={reversing}
                onClick={onReverse}
              >
                <IconRepeat size={15} /> Estornar
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
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

/** Wrapper de campo Select para os formulários de lançamento. */
function FieldSelect({
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      <Select
        aria-label={label}
        selectedKey={value || null}
        onSelectionChange={(k) => onChange(k ? String(k) : NONE)}
      >
        <Select.Trigger>
          <Select.Value>
            {({ isPlaceholder, selectedText }) =>
              isPlaceholder ? placeholder : selectedText
            }
          </Select.Value>
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

/**
 * Formulário de Recebimento / Despesa / Vale.
 * - recebimento: receita, com "Recebido de" (cliente).
 * - despesa: despesa, com "Pago para" (profissional) opcional.
 * - vale: despesa p/ profissional (obrigatório).
 */
function LancamentoModal({
  mode,
  editing,
  onClose,
}: {
  mode: LancamentoMode;
  editing: TransactionRow | null;
  onClose: () => void;
}) {
  const isVale = mode === 'vale';
  const kind: TransactionKind = mode === 'recebimento' ? 'income' : 'expense';

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [status, setStatus] = useState<PaymentStatus>('paid');
  const [dueDate, setDueDate] = useState(() => isoDate(new Date()));
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const categories = useFinancialCategories();
  const paymentMethods = usePaymentMethods();
  const accounts = useFinancialAccounts();
  const customers = useCustomers('', 1, 50);
  const professionals = useProfessionals(1, 50);
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();

  useEffect(() => {
    if (editing) {
      setAmount(String(editing.grossAmount));
      setDescription(editing.description ?? '');
      setCategoryId(editing.categoryId ?? '');
      setPaymentMethodId(editing.paymentMethodId ?? '');
      setAccountId(editing.accountId ?? '');
      setPartyId(editing.partyId ?? '');
      setStatus(editing.status === 'reversed' ? 'paid' : editing.status);
      setDueDate(
        editing.dueDate ? isoDate(new Date(editing.dueDate)) : isoDate(new Date()),
      );
    } else {
      setAmount('');
      setDescription('');
      setCategoryId('');
      setPaymentMethodId('');
      setAccountId('');
      setPartyId('');
      setStatus('paid');
      setDueDate(isoDate(new Date()));
    }
    setFormError(null);
    setSuccess(false);
  }, [editing, mode]);

  const isPending = createTransaction.isPending || updateTransaction.isPending;
  const numericAmount = useMemo(() => Number(amount.replace(',', '.')), [amount]);
  const canConfirm =
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    (!isVale || Boolean(partyId)) &&
    !isPending;

  const customerName = (id: string) =>
    (customers.data?.data ?? []).find((c) => c.id === id)?.name ?? '';
  const professionalName = (id: string) =>
    (professionals.data?.data ?? []).find((p) => p.id === id)?.name ?? '';

  function autoDescription(): string {
    const typed = description.trim();
    if (typed) return typed;
    if (mode === 'recebimento' && partyId)
      return `Recebimento de ${customerName(partyId)}`;
    if (mode === 'vale' && partyId) return `Vale para ${professionalName(partyId)}`;
    if (mode === 'despesa' && partyId)
      return `Pagamento para ${professionalName(partyId)}`;
    return MODE_LABEL[mode];
  }

  async function handleConfirm() {
    setFormError(null);
    if (!canConfirm) {
      setFormError(
        isVale && !partyId
          ? 'Selecione o profissional do vale.'
          : 'Informe um valor válido.',
      );
      return;
    }
    const body: CreateTransactionBody = {
      kind,
      grossAmount: numericAmount,
      status,
      dueDate,
      ...(status === 'paid' ? { paidAt: new Date().toISOString() } : {}),
      description: autoDescription(),
      categoryId: categoryId || undefined,
      paymentMethodId: paymentMethodId || undefined,
      accountId: accountId || undefined,
      ...(partyId
        ? {
            partyId,
            partyType: mode === 'recebimento' ? 'customer' : 'professional',
          }
        : {}),
    };
    try {
      if (editing) {
        await updateTransaction.mutateAsync({ id: editing.id, body });
        onClose();
      } else {
        await createTransaction.mutateAsync(body);
        setSuccess(true);
      }
    } catch (err) {
      setFormError(
        err instanceof ApiClientError
          ? err.message || 'Não foi possível salvar o lançamento.'
          : 'Não foi possível salvar o lançamento. Tente novamente.',
      );
    }
  }

  const title = editing
    ? `Editar ${mode === 'recebimento' ? 'recebimento' : 'despesa'}`
    : `Novo ${MODE_LABEL[mode].toLowerCase()}`;

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
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
                  <p className="text-base font-semibold text-foreground">
                    Lançamento registrado com sucesso!
                  </p>
                </div>
              ) : (
                <>
                  {/* Valor */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted">
                      Valor (R$)
                    </label>
                    <TextField value={amount} onChange={setAmount} aria-label="Valor">
                      <Input placeholder="0,00" inputMode="decimal" />
                    </TextField>
                  </div>

                  {/* Recebido de (cliente) */}
                  {mode === 'recebimento' && (
                    <FieldSelect
                      label="Recebido de (cliente)"
                      placeholder="Selecione (opcional)"
                      value={partyId}
                      onChange={setPartyId}
                      options={(customers.data?.data ?? []).map((c) => ({
                        id: c.id,
                        name: c.name,
                      }))}
                    />
                  )}

                  {/* Profissional (vale / despesa) */}
                  {(mode === 'vale' || mode === 'despesa') && (
                    <FieldSelect
                      label={
                        isVale
                          ? 'Profissional (obrigatório)'
                          : 'Pago para (profissional)'
                      }
                      placeholder={isVale ? 'Selecione' : 'Selecione (opcional)'}
                      value={partyId}
                      onChange={setPartyId}
                      options={(professionals.data?.data ?? []).map((p) => ({
                        id: p.id,
                        name: p.name,
                      }))}
                    />
                  )}

                  {/* Descrição */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted">
                      Descrição
                    </label>
                    <TextField
                      value={description}
                      onChange={setDescription}
                      aria-label="Descrição"
                    >
                      <Input placeholder="Gerada automaticamente se vazio" />
                    </TextField>
                  </div>

                  {/* Categoria (oculto no vale) */}
                  {!isVale && (
                    <FieldSelect
                      label="Categoria"
                      placeholder="Selecione (opcional)"
                      value={categoryId}
                      onChange={setCategoryId}
                      options={(categories.data ?? []).map((c) => ({
                        id: c.id,
                        name: c.name,
                      }))}
                    />
                  )}

                  {/* Forma de pagamento */}
                  <FieldSelect
                    label="Forma de pagamento"
                    placeholder="Selecione (opcional)"
                    value={paymentMethodId}
                    onChange={setPaymentMethodId}
                    options={(paymentMethods.data ?? []).map((m) => ({
                      id: m.id,
                      name: m.name,
                    }))}
                  />

                  {/* Conta */}
                  <FieldSelect
                    label="Conta"
                    placeholder="Selecione (opcional)"
                    value={accountId}
                    onChange={setAccountId}
                    options={(accounts.data ?? []).map((a) => ({
                      id: a.id,
                      name: a.name,
                    }))}
                  />

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
                        onSelectionChange={(k) =>
                          setStatus(String(k) as PaymentStatus)
                        }
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
                  onClick={onClose}
                >
                  Fechar
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={onClose}
                  >
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
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** Transferência entre contas (gera um par de lançamentos). */
function TransferenciaModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const accounts = useFinancialAccounts();
  const transfer = useCreateTransfer();

  const numericAmount = useMemo(() => Number(amount.replace(',', '.')), [amount]);
  const canConfirm =
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    Boolean(fromAccountId) &&
    Boolean(toAccountId) &&
    fromAccountId !== toAccountId &&
    !transfer.isPending;

  const accountOptions = (accounts.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  async function handleConfirm() {
    setFormError(null);
    if (!canConfirm) {
      setFormError(
        fromAccountId && fromAccountId === toAccountId
          ? 'Origem e destino devem ser diferentes.'
          : 'Preencha valor e contas de origem/destino.',
      );
      return;
    }
    try {
      await transfer.mutateAsync({
        amount: numericAmount,
        fromAccountId,
        toAccountId,
        description: description.trim() || undefined,
        date,
      });
      setSuccess(true);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError
          ? err.message || 'Não foi possível transferir.'
          : 'Não foi possível transferir. Tente novamente.',
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container
          placement="center"
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Nova transferência</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {success ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f2b33d]/15 text-2xl text-[#a67c1e]">
                    ✓
                  </div>
                  <p className="text-base font-semibold text-foreground">
                    Transferência registrada com sucesso!
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted">
                      Valor (R$)
                    </label>
                    <TextField value={amount} onChange={setAmount} aria-label="Valor">
                      <Input placeholder="0,00" inputMode="decimal" />
                    </TextField>
                  </div>

                  <FieldSelect
                    label="Conta de origem"
                    placeholder="Selecione"
                    value={fromAccountId}
                    onChange={setFromAccountId}
                    options={accountOptions}
                  />
                  <FieldSelect
                    label="Conta de destino"
                    placeholder="Selecione"
                    value={toAccountId}
                    onChange={setToAccountId}
                    options={accountOptions}
                  />

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted">
                      Descrição
                    </label>
                    <TextField
                      value={description}
                      onChange={setDescription}
                      aria-label="Descrição"
                    >
                      <Input placeholder="Gerada automaticamente se vazio" />
                    </TextField>
                  </div>

                  <DateField
                    label="Data"
                    value={date}
                    onChange={setDate}
                    className="min-w-0"
                  />

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
                  onClick={onClose}
                >
                  Fechar
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={onClose}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    className="w-full sm:w-auto"
                    isDisabled={!canConfirm}
                    onClick={handleConfirm}
                  >
                    {transfer.isPending ? 'Salvando…' : 'Transferir'}
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
