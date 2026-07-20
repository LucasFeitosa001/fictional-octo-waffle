import { useEffect, useMemo, useState } from 'react';
import { useSetPageActions } from '../../layout/PageActions';
import {
  Button,
  Card,
  Chip,
  Dropdown,
  Input,
  ListBox,
  Select,
  Switch,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  IconArrowDown,
  IconArrowUp,
  IconCalculator,
  IconCheck,
  IconChevron,
  IconDollar,
  IconDownload,
  IconFilter,
  IconPencil,
  IconPlus,
  IconRepeat,
  IconSearch,
  IconWallet,
} from '../../components/icons';
import { DateFieldBR } from '../../components/DateRangeFilter';
import { useConfirm } from '../../components/ConfirmDialog';
import { Drawer } from '../../components/Drawer';
import { formatDate, formatMoney, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useCustomers, useProfessionals } from '../../lib/queries';
import {
  fetchAllTransactions,
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

const PAGE_SIZE = 30;

const CARD_CLASS =
  'border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]';

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

/** Titular (cliente/profissional) — do cadastro da comanda ou extraído do "… para NOME". */
function titular(t: TransactionRow): string {
  if (t.order?.customer?.name) return t.order.customer.name;
  const d = (t.description || '').trim();
  const m = /\bpara\s+(.+)$/i.exec(d);
  if (m) return m[1].trim();
  return d || (t.kind === 'income' ? 'Recebimento' : 'Despesa');
}

/** Origem: comanda (C#nº) quando houver, senão a categoria/natureza. */
function origem(t: TransactionRow): string {
  if (t.order) return `C#${t.order.number}`;
  // Importação Belasis não linka o orderId, mas cita o nº na descrição.
  const m = /comanda\s+#?(\d+)/i.exec(t.description || '');
  if (m) return `C#${m[1]}`;
  return t.category?.name ?? '—';
}

export function TransacoesPage() {
  const confirm = useConfirm();
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>(
    'all',
  );
  const [showReversed, setShowReversed] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [methodFilter, setMethodFilter] = useState(ALL);
  const [formMode, setFormMode] = useState<LancamentoMode | null>(null);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [page, setPage] = useState(1);

  // Toolbar do Belasis: Buscar (input revelado), Filtrar (drawer lateral),
  // Calcular totais (mostra a faixa de totais sob demanda, como no Belasis).
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [showTotals, setShowTotals] = useState(false);

  // Qualquer mudança de filtro volta para a primeira página.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, methodFilter, from, to, showReversed]);

  const paymentMethods = usePaymentMethods();

  const transactions = useTransactions({
    status: statusFilter === 'all' ? undefined : statusFilter,
    paymentMethodId: methodFilter === ALL ? undefined : methodFilter,
    from: from || undefined,
    to: to || undefined,
    includeReversed: showReversed,
    page,
    pageSize: PAGE_SIZE,
  });
  const reverse = useReverseTransaction();

  // O servidor já ordena por data (mais recentes primeiro, sem data no fim),
  // pagina e oculta as estornadas conforme `includeReversed`.
  const rows = transactions.data?.data ?? [];
  // Busca "Buscar" filtra a página atual no cliente por titular/descrição.
  // TODO: mover a busca para o servidor (a query não expõe parâmetro `q`).
  const q = query.trim().toLowerCase();
  const visibleRows = q
    ? rows.filter(
        (t) =>
          titular(t).toLowerCase().includes(q) ||
          describe(t).toLowerCase().includes(q),
      )
    : rows;
  const total = transactions.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Totais do conjunto INTEIRO filtrado (não só a página), vindos do servidor.
  const totals = transactions.data?.totals ?? {
    income: 0,
    expense: 0,
    balance: 0,
  };

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (showReversed ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0) +
    (methodFilter !== ALL ? 1 : 0);
  const hasFilters = activeFilterCount > 0;

  function clearFilters() {
    setStatusFilter('all');
    setShowReversed(false);
    setFrom('');
    setTo('');
    setMethodFilter(ALL);
  }

  const [exporting, setExporting] = useState(false);
  async function exportCsv() {
    setExporting(true);
    try {
      // Exporta o conjunto INTEIRO do filtro atual, não apenas a página visível.
      const all = await fetchAllTransactions({
        status: statusFilter === 'all' ? undefined : statusFilter,
        paymentMethodId: methodFilter === ALL ? undefined : methodFilter,
        from: from || undefined,
        to: to || undefined,
        includeReversed: showReversed,
      });
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
        all,
      );
    } catch {
      window.alert('Não foi possível exportar as transações.');
    } finally {
      setExporting(false);
    }
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

  // Belasis-style: no mobile (BottomNav inferior, ativa <lg) as ações da toolbar
  // vivem na navbar inferior — não inline no header. Cada onClick dispara EXATAMENTE
  // o mesmo handler do botão desktop. Setters são estáveis e openForm é hoisted, por
  // isso o registro é criado uma vez (deps []) e limpo ao desmontar.
  useSetPageActions(
    [
      { key: 'buscar', label: 'Buscar', icon: <IconSearch size={22} />, onClick: () => setSearchOpen((o) => !o) },
      { key: 'filtros', label: 'Filtros', icon: <IconFilter size={22} />, onClick: () => setFilterOpen(true) },
      { key: 'totais', label: 'Totais', icon: <IconCalculator size={22} />, onClick: () => setShowTotals((t) => !t) },
      { key: 'novo', label: 'Novo', icon: <IconPlus size={22} />, onClick: () => openForm('recebimento') },
    ],
    [],
  );

  async function handleReverse(t: TransactionRow) {
    const ok = await confirm({
      title: 'Estornar transação?',
      message:
        'A original será preservada e marcada como estornada. Essa ação não pode ser desfeita.',
      confirmLabel: 'Estornar',
      danger: true,
    });
    if (!ok) return;
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

  // Tabela (desktop) / cards (mobile) com paridade da tela de transações do Belasis.
  const columns: Column<TransactionRow>[] = [
    {
      key: 'data',
      header: 'Data',
      className: 'whitespace-nowrap text-sm text-muted',
      render: (t) => formatDate(t.dueDate),
    },
    {
      key: 'titular',
      header: 'Titular',
      isRowHeader: true,
      render: (t) => {
        const name = titular(t);
        const desc = describe(t);
        return (
          <div className="min-w-0 max-w-[280px]">
            <div
              className={`truncate font-medium text-foreground ${
                t.status === 'reversed' ? 'line-through opacity-60' : ''
              }`}
            >
              {name}
            </div>
            {desc && desc !== name && (
              <div className="truncate text-xs text-muted">{desc}</div>
            )}
          </div>
        );
      },
    },
    {
      key: 'origem',
      header: 'Origem',
      className: 'whitespace-nowrap text-sm',
      // Belasis: origem da comanda vira link (C#NNNN); senão categoria em cinza.
      render: (t) => {
        const o = origem(t);
        return o.startsWith('C#') ? (
          <span className="font-medium text-primary hover:underline">{o}</span>
        ) : (
          <span className="text-muted">{o}</span>
        );
      },
    },
    {
      key: 'forma',
      header: 'Forma de pagamento',
      className: 'whitespace-nowrap text-sm',
      render: (t) => t.paymentMethod?.name ?? '—',
    },
    {
      key: 'categoria',
      header: 'Categoria',
      render: (t) =>
        t.category ? (
          <Chip variant="soft" color="accent" size="sm">
            {t.category.name}
          </Chip>
        ) : (
          '—'
        ),
    },
    {
      key: 'bruto',
      header: 'Valor bruto',
      className: 'whitespace-nowrap text-right',
      render: (t) => (
        <span
          className={`text-sm font-semibold ${
            t.kind === 'income' ? 'text-success' : 'text-danger'
          }`}
        >
          {t.kind === 'income' ? '+' : '−'}
          {formatMoney(t.grossAmount)}
        </span>
      ),
    },
    {
      key: 'liquido',
      header: 'Valor líquido',
      className: 'whitespace-nowrap text-right',
      render: (t) => (
        <div className="text-right">
          <div className="text-sm font-medium text-foreground">
            {formatMoney(t.grossAmount)}
          </div>
          {t.account && (
            <div className="text-xs text-muted">{t.account.name}</div>
          )}
        </div>
      ),
    },
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
      key: 'pago',
      header: 'Pago',
      className: 'text-center',
      // Belasis: coluna "Pago" é um toggle (aceso quando pago).
      render: (t) => {
        const paid = t.status === 'paid';
        return (
          <span
            role="img"
            aria-label={paid ? 'Pago' : 'Em aberto'}
            title={paid ? 'Pago' : 'Em aberto'}
            className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
              paid
                ? 'justify-end bg-primary'
                : 'justify-start bg-[var(--color-soft-border)]'
            }`}
          >
            <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (t) =>
        t.status === 'reversed' ? null : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
              <IconPencil size={15} /> Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={reverse.isPending}
              onClick={() => handleReverse(t)}
            >
              <IconRepeat size={15} /> Estornar
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div>
      {/* Cabeçalho + toolbar do Belasis: título à esquerda; à direita
          Buscar · Filtrar · Calcular totais · Exportar · Novo ▾. */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">
            Transações
          </h1>
          <p className="mt-1 text-sm leading-snug text-muted">
            Recebimentos, despesas, vales e transferências
          </p>
        </div>
        <div className="hidden gap-2 sm:w-auto sm:flex-wrap sm:justify-end lg:flex">
          <Button
            variant={searchOpen ? 'primary' : 'outline'}
            onClick={() => setSearchOpen((o) => !o)}
          >
            <IconSearch size={16} /> Buscar
          </Button>
          <Button
            variant="outline"
            onClick={() => setFilterOpen(true)}
            className="relative"
          >
            <IconFilter size={16} /> Filtrar
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-semibold text-[var(--color-on-gold,#3a2f16)]">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            variant={showTotals ? 'primary' : 'outline'}
            onClick={() => setShowTotals((t) => !t)}
          >
            <IconCalculator size={16} /> Calcular totais
          </Button>
          <Button
            variant="outline"
            onClick={exportCsv}
            isDisabled={total === 0 || exporting}
            aria-label="Exportar CSV"
          >
            <IconDownload size={16} />
            <span className="sm:hidden"> {exporting ? 'Exportando…' : 'Exportar'}</span>
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
        </div>
      </div>

      {/* Buscar (revelado ao clicar em Buscar) */}
      {searchOpen && (
        <div className="mb-4">
          <TextField value={query} onChange={setQuery} aria-label="Buscar transações">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <IconSearch size={16} />
              </span>
              <Input
                autoFocus
                placeholder="Buscar por titular ou descrição…"
                className="pl-9"
              />
            </div>
          </TextField>
        </div>
      )}

      {/* Totais sob demanda (botão "Calcular totais", como no Belasis) */}
      {showTotals && (
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
      )}

      <Card className={CARD_CLASS}>
        <Card.Content className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted">Ordenado por data</span>
            <span className="text-xs text-muted">
              {total > 0 ? `${total} no total` : '0 lançamento(s)'}
            </span>
          </div>
          {transactions.isLoading ? (
            <LoadingState />
          ) : transactions.isError ? (
            <ErrorState onRetry={() => transactions.refetch()} />
          ) : visibleRows.length === 0 ? (
            <EmptyState
              icon={<IconDollar size={32} />}
              title={
                q
                  ? 'Nenhum item encontrado'
                  : hasFilters
                    ? 'Nenhuma transação para os filtros'
                    : 'Nenhuma transação registrada'
              }
              description={
                q
                  ? 'Ajuste a busca para ver mais lançamentos.'
                  : hasFilters
                    ? 'Ajuste os filtros para ver mais lançamentos.'
                    : 'Lance recebimentos e despesas para acompanhar o caixa.'
              }
            />
          ) : (
            <DataTable
              columns={columns}
              rows={visibleRows}
              getKey={(t) => t.id}
              aria-label="Transações"
            />
          )}
          {total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-soft-border)] pt-3">
              <span className="text-xs text-muted">{total} no total</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Página anterior"
                  isDisabled={page <= 1 || transactions.isFetching}
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
                  isDisabled={page >= pageCount || transactions.isFetching}
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

      {/* Filtrar: drawer lateral (direita) com as seções do Belasis. */}
      <FiltrosDrawer
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        methodFilter={methodFilter}
        setMethodFilter={setMethodFilter}
        paymentMethods={(paymentMethods.data ?? []).map((m) => ({
          id: m.id,
          name: m.name,
        }))}
        showReversed={showReversed}
        setShowReversed={setShowReversed}
        hasFilters={hasFilters}
        onClear={clearFilters}
      />

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

/**
 * Drawer de filtros (Belasis "Filtrar"): desliza da direita e agrupa as seções
 * Período, Status de pagamento, Formas de pagamento e Estornadas. Aplica ao vivo
 * (as queries reagem ao estado); "Aplicar" apenas fecha. As seções Contas/
 * Categorias do Belasis dependem de filtro no servidor.
 * TODO: expor filtro por conta/categoria na query de transações.
 */
function FiltrosDrawer({
  isOpen,
  onClose,
  from,
  to,
  setFrom,
  setTo,
  statusFilter,
  setStatusFilter,
  methodFilter,
  setMethodFilter,
  paymentMethods,
  showReversed,
  setShowReversed,
  hasFilters,
  onClear,
}: {
  isOpen: boolean;
  onClose: () => void;
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  statusFilter: 'all' | 'paid' | 'pending';
  setStatusFilter: (v: 'all' | 'paid' | 'pending') => void;
  methodFilter: string;
  setMethodFilter: (v: string) => void;
  paymentMethods: { id: string; name: string }[];
  showReversed: boolean;
  setShowReversed: (v: boolean) => void;
  hasFilters: boolean;
  onClear: () => void;
}) {
  const statusOptions: { id: 'all' | 'paid' | 'pending'; name: string }[] = [
    { id: 'all', name: 'Todos' },
    { id: 'paid', name: 'Pago' },
    { id: 'pending', name: 'Em aberto' },
  ];
  const methodOptions = [{ id: ALL, name: 'Todas as formas' }, ...paymentMethods];

  const footer = (
    <>
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        isDisabled={!hasFilters}
        onClick={onClear}
      >
        Limpar filtros
      </Button>
      <Button variant="primary" className="w-full sm:w-auto" onClick={onClose}>
        Aplicar
      </Button>
    </>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Filtrar"
      footer={footer}
      widthClass="sm:w-[420px]"
    >
      <div className="flex flex-col gap-6">
        {/* Período */}
        <FilterSection title="Período">
          <div className="grid grid-cols-2 gap-3">
            <DateFieldBR label="De" value={from} onChange={setFrom} className="min-w-0" />
            <DateFieldBR label="Até" value={to} onChange={setTo} className="min-w-0" />
          </div>
        </FilterSection>

        {/* Status de pagamento (segmentado) */}
        <FilterSection title="Status de pagamento">
          <div className="grid grid-cols-3 gap-2">
            {statusOptions.map((o) => {
              const active = statusFilter === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setStatusFilter(o.id)}
                  className={`h-9 rounded-lg border px-2 text-sm font-medium transition-colors ${
                    active
                      ? 'border-transparent bg-gold text-[var(--color-on-gold,#3a2f16)]'
                      : 'border-[var(--color-soft-border)] bg-white text-foreground hover:bg-cream'
                  }`}
                >
                  {o.name}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* Formas de pagamento (lista selecionável) */}
        <FilterSection title="Formas de pagamento">
          <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--color-soft-border)]">
            {methodOptions.map((o, i) => {
              const active = methodFilter === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setMethodFilter(o.id)}
                  className={`flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                    i > 0 ? 'border-t border-[var(--color-soft-border)]' : ''
                  } ${active ? 'bg-gold/12 font-medium text-foreground' : 'bg-white text-foreground hover:bg-cream'}`}
                >
                  <span className="truncate">{o.name}</span>
                  {active && <IconCheck size={16} className="shrink-0 text-gold-strong" />}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* Estornadas */}
        <FilterSection title="Estornadas">
          <Switch
            isSelected={showReversed}
            onChange={setShowReversed}
            className="flex h-11 items-center justify-between gap-3 rounded-lg border border-[var(--color-soft-border)] bg-white px-3"
          >
            <span className="text-sm text-foreground">Mostrar estornadas</span>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </FilterSection>
      </div>
    </Drawer>
  );
}

/** Bloco de seção do drawer de filtros (título + conteúdo). */
function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </span>
      {children}
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
        : 'bg-gold/15 text-gold-strong';
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
    <Drawer isOpen onClose={onClose} title={title} footer={footer} widthClass="sm:w-[460px]">
      {success ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-3xl text-gold-strong">
            ✓
          </div>
          <p className="text-base font-semibold text-foreground">
            Lançamento registrado com sucesso!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Ordem espelha o Belasis: Valor → Descrição → Vencimento → Forma → Conta. */}
          {/* 1. Valor */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Valor (R$)</label>
            <TextField value={amount} onChange={setAmount} aria-label="Valor">
              <Input placeholder="0,00" inputMode="decimal" />
            </TextField>
          </div>

          {/* 2. Descrição */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Descrição</label>
            <TextField value={description} onChange={setDescription} aria-label="Descrição">
              <Input placeholder="Gerada automaticamente se vazio" />
            </TextField>
          </div>

          {/* 3. Vencimento (dd/mm/aaaa) */}
          <DateFieldBR
            label="Vencimento"
            value={dueDate}
            onChange={setDueDate}
            className="min-w-0"
          />

          {/* 4. Forma de pagamento */}
          <FieldSelect
            label="Forma de pagamento"
            placeholder="Selecione (opcional)"
            value={paymentMethodId}
            onChange={setPaymentMethodId}
            options={(paymentMethods.data ?? []).map((m) => ({ id: m.id, name: m.name }))}
          />

          {/* 5. Conta */}
          <FieldSelect
            label="Conta"
            placeholder="Selecione (opcional)"
            value={accountId}
            onChange={setAccountId}
            options={(accounts.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
          />

          <div className="my-1 h-px bg-[var(--color-soft-border)]" />

          {/* Extras (não existem no Belasis, mas úteis no nosso app). */}
          {/* Categoria (oculto no vale) */}
          {!isVale && (
            <FieldSelect
              label="Categoria"
              placeholder="Selecione (opcional)"
              value={categoryId}
              onChange={setCategoryId}
              options={(categories.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
            />
          )}

          {/* Titular: cliente (recebimento) ou profissional (vale/despesa) */}
          {mode === 'recebimento' && (
            <FieldSelect
              label="Recebido de (cliente)"
              placeholder="Selecione (opcional)"
              value={partyId}
              onChange={setPartyId}
              options={(customers.data?.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
            />
          )}
          {(mode === 'vale' || mode === 'despesa') && (
            <FieldSelect
              label={isVale ? 'Profissional (obrigatório)' : 'Pago para (profissional)'}
              placeholder={isVale ? 'Selecione' : 'Selecione (opcional)'}
              value={partyId}
              onChange={setPartyId}
              options={(professionals.data?.data ?? []).map((p) => ({ id: p.id, name: p.name }))}
            />
          )}

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Status</label>
            <Select
              aria-label="Status"
              selectedKey={status}
              onSelectionChange={(k) => setStatus(String(k) as PaymentStatus)}
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
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

          {formError && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </div>
          )}
        </div>
      )}
    </Drawer>
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
        {transfer.isPending ? 'Salvando…' : 'Transferir'}
      </Button>
    </>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Nova transferência"
      footer={footer}
      widthClass="sm:w-[460px]"
    >
      {success ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-3xl text-gold-strong">
            ✓
          </div>
          <p className="text-base font-semibold text-foreground">
            Transferência registrada com sucesso!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Valor (R$)</label>
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

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Descrição</label>
            <TextField value={description} onChange={setDescription} aria-label="Descrição">
              <Input placeholder="Gerada automaticamente se vazio" />
            </TextField>
          </div>

          <DateFieldBR label="Data" value={date} onChange={setDate} className="min-w-0" />

          {formError && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
