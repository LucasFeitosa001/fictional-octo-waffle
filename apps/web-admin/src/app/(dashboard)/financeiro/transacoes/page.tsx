'use client';

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
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { IconDollar, IconPlus } from '@/components/icons';
import { DateField } from '@/components/DateRangeFilter';
import { formatDate, formatMoney, isoDate } from '@/lib/format';
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
} from '@/lib/queries/financeiro';

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

export default function TransacoesPage() {
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionKind>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);

  const transactions = useTransactions(
    typeFilter === 'all' ? {} : { type: typeFilter },
  );
  const del = useDeleteTransaction();

  const rows = transactions.data?.data ?? [];

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
        <span className="font-medium text-foreground">{t.description ?? '—'}</span>
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
            t.kind === 'income'
              ? 'font-semibold text-success'
              : 'font-semibold text-danger'
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
      header: 'Ações',
      render: (t) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            isDisabled={del.isPending}
            onClick={() => handleRemove(t)}
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
        title="Transações"
        subtitle="Lançamentos de receitas e despesas"
        onRefresh={() => transactions.refetch()}
        isRefreshing={transactions.isFetching}
        actions={
          <Button variant="primary" onClick={openCreate}>
            <IconPlus size={16} /> Nova transação
          </Button>
        }
      />

      <Card className="db-card">
        <Card.Content className="p-4">
          <div className="mb-4 flex flex-wrap gap-2 sm:max-w-xs">
            <Select
              aria-label="Filtrar por tipo"
              selectedKey={typeFilter}
              onSelectionChange={(k) =>
                setTypeFilter(String(k) as 'all' | TransactionKind)
              }
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="all" textValue="Todas">
                    Todas
                  </ListBox.Item>
                  <ListBox.Item id="income" textValue="Receitas">
                    Receitas
                  </ListBox.Item>
                  <ListBox.Item id="expense" textValue="Despesas">
                    Despesas
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {transactions.isLoading ? (
            <LoadingState />
          ) : transactions.isError ? (
            <ErrorState onRetry={() => transactions.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconDollar size={32} />}
              title="Nenhuma transação registrada"
              description="Lance receitas e despesas para acompanhar o caixa."
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
        setDueDate(
          editing.dueDate ? isoDate(new Date(editing.dueDate)) : isoDate(new Date()),
        );
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
              <Modal.Heading>
                {editing ? 'Editar transação' : 'Nova transação'}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {success ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-foreground">
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
                              ? 'border-white bg-white text-black'
                              : 'border-white/15 text-foreground hover:border-white')
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
                      onSelectionChange={(k) =>
                        setPaymentMethodId(k ? String(k) : NONE)
                      }
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
