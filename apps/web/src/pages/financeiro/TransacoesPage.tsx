import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { EmptyState, ErrorState } from '../../components/States';
import { TableSkeleton } from '../../components/Skeletons';
import {
  IconArrowDown,
  IconArrowUp,
  IconCalculator,
  IconCheck,
  IconChevron,
  IconDollar,
  IconFilter,
  IconPencil,
  IconPlay,
  IconPlus,
  IconRepeat,
  IconSearch,
  IconTrash,
  IconWallet,
  IconX,
} from '../../components/icons';
import { DateFieldBR } from '../../components/DateRangeFilter';
import { IconTip } from '../../components/IconTip';
import { useConfirm } from '../../components/ConfirmDialog';
import { Drawer } from '../../components/Drawer';
import { FullDrawer } from '../../components/FullDrawer';
import { HelpTooltip } from '../../components/HelpTooltip';
import { AnimatedCheckbox } from '../../components/AnimatedCheckbox';
import { BulkActionsSheet } from '../../components/BulkActionsSheet';
import { useSelectMode, buildSelectActions, type BulkAction } from '../../hooks/useSelectMode';
import { FilterAside } from '../../components/FilterAside';
import { useIsMobile } from '../../hooks/useIsMobile';
import { formatDate, formatMoney, isoDate } from '../../lib/format';
import { useCustomers, useProfessionals } from '../../lib/queries';
import { useSuppliers } from '../../lib/queries/catalogo';
import {
  useCreateTransaction,
  useCreateTransfer,
  useDeleteTransaction,
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

/**
 * Data no formato Belasis mobile: "20 jul, 2026" (dia + mês abreviado + ano).
 * Difere de formatDate() (que retorna "20/07/2026", pt-BR short).
 */
const MESES_ABBR = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];
function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MESES_ABBR[d.getMonth()]}, ${d.getFullYear()}`;
}

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
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');
  const initialKind = searchParams.get('kind');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>(
    initialStatus === 'paid' || initialStatus === 'pending'
      ? initialStatus
      : 'all',
  );
  const [kindFilter, setKindFilter] = useState<'all' | TransactionKind>(
    initialKind === 'income' || initialKind === 'expense'
      ? initialKind
      : 'all',
  );
  const [showReversed, setShowReversed] = useState(false);
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');
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
  const isMobile = useIsMobile();

  // Modo de seleção (Belasis): habilitado via BottomNav "Selecionar". Enquanto
  // ativo, tocar num card alterna a seleção em vez de abrir edição. Sai do modo
  // limpando a seleção acumulada. Agora usa a infra padrão (useSelectMode) —
  // ids/allSelected vêm de `visibleRows`, montado logo abaixo.
  const deleteTransaction = useDeleteTransaction();
  const [actionsOpen, setActionsOpen] = useState(false);

  // Qualquer mudança de filtro volta para a primeira página.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, kindFilter, methodFilter, from, to, showReversed]);

  useEffect(() => {
    const status = searchParams.get('status');
    const kind = searchParams.get('kind');
    setStatusFilter(
      status === 'paid' || status === 'pending' ? status : 'all',
    );
    setKindFilter(
      kind === 'income' || kind === 'expense' ? kind : 'all',
    );
    setFrom(searchParams.get('from') ?? '');
    setTo(searchParams.get('to') ?? '');
  }, [searchParams]);

  const paymentMethods = usePaymentMethods();

  const transactions = useTransactions({
    type: kindFilter === 'all' ? undefined : kindFilter,
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

  // Modo de seleção sobre os ids VISÍVEIS (página atual + busca cliente).
  const ids = useMemo(() => visibleRows.map((r) => r.id), [visibleRows]);
  const sel = useSelectMode(ids);

  // Exclui de verdade os selecionados (Promise.all no hook de delete existente),
  // após confirmação. Depois fecha a sheet e sai do modo de seleção.
  const bulkActions: BulkAction[] = [
    {
      key: 'delete',
      label: 'Excluir selecionados',
      danger: true,
      icon: <IconTrash size={18} />,
      disabled: deleteTransaction.isPending,
      onClick: async () => {
        const ok = await confirm({
          title: 'Excluir transações?',
          message: `Excluir ${sel.count} lançamento(s) selecionado(s)? Essa ação não pode ser desfeita.`,
          confirmLabel: 'Excluir',
          danger: true,
        });
        if (!ok) return;
        try {
          await Promise.all(
            [...sel.selected].map((id) => deleteTransaction.mutateAsync(id)),
          );
          setActionsOpen(false);
          sel.cancel();
        } catch (err) {
          window.alert(
            err instanceof ApiClientError
              ? err.message
              : 'Não foi possível excluir as transações.',
          );
        }
      },
    },
  ];
  // Totais do conjunto INTEIRO filtrado (não só a página), vindos do servidor.
  const totals = transactions.data?.totals ?? {
    income: 0,
    expense: 0,
    balance: 0,
  };

  const activeFilterCount =
    (kindFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (showReversed ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0) +
    (methodFilter !== ALL ? 1 : 0);
  const hasFilters = activeFilterCount > 0;

  function clearFilters() {
    setKindFilter('all');
    setStatusFilter('all');
    setShowReversed(false);
    setFrom('');
    setTo('');
    setMethodFilter(ALL);
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
  // Mobile: BottomNav do Belasis = Filtros · Calcular totais · Criar (Menu/Selecionar
  // vêm do shell). A busca fica sempre visível no topo, então não há ação "Buscar".
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
          { key: 'filtros', label: 'Filtros', icon: <IconFilter size={22} />, onClick: () => setFilterOpen((v) => !v) },
          { key: 'totais', label: 'Calcular totais', icon: <IconCalculator size={22} />, onClick: () => setShowTotals((t) => !t) },
          {
            key: 'selecionar',
            label: 'Selecionar',
            icon: <IconCheck size={22} />,
            onClick: sel.enter,
          },
          { key: 'novo', label: 'Criar', icon: <IconPlus size={22} />, onClick: () => openForm('recebimento') },
        ],
    [sel.selectMode, sel.allSelected, sel.count],
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
              className={`truncate font-medium ${
                t.status === 'reversed'
                  ? 'text-foreground line-through opacity-60'
                  : 'text-primary hover:underline'
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
          <span className="font-medium text-foreground">{o}</span>
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
      // Belasis: coluna "Pago" é um switch (44×22, aceso azul quando pago).
      render: (t) => {
        const paid = t.status === 'paid';
        return (
          <span
            role="img"
            aria-label={paid ? 'Pago' : 'Em aberto'}
            title={paid ? 'Pago' : 'Em aberto'}
            className={`inline-flex h-[22px] w-11 items-center rounded-full p-0.5 transition-colors duration-200 ${
              paid
                ? 'justify-end bg-primary'
                : 'justify-start bg-[var(--color-soft-border)]'
            }`}
          >
            <span className="h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all duration-200" />
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (t) =>
        t.status === 'reversed' ? null : (
          <div className="flex items-center justify-end gap-1">
            <IconTip label="Editar">
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label="Editar"
                onClick={() => openEdit(t)}
              >
                <IconPencil size={16} />
              </Button>
            </IconTip>
            <IconTip label="Estornar">
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label="Estornar"
                isDisabled={reverse.isPending}
                onClick={() => handleReverse(t)}
              >
                <IconRepeat size={16} />
              </Button>
            </IconTip>
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
          <div className="flex items-center gap-2.5">
            <h1 className="text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">
              Transações
            </h1>
            {/* Botão "assista o tutorial" ao lado do título (play-circle do Belasis) */}
            <span
              aria-hidden
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--sp-primary,#505afb)]/10 text-[color:var(--sp-primary,#505afb)]"
            >
              <IconPlay size={16} className="ml-0.5" />
            </span>
          </div>
          <p className="mt-1 hidden text-sm leading-snug text-muted sm:block">
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
            onClick={() => setFilterOpen((v) => !v)}
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
          <Dropdown>
            <Dropdown.Trigger>
              <Button variant="primary">
                <IconPlus size={16} /> Novo
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="Tipo de lançamento">
                <Dropdown.Item
                  textValue="Recebimento"
                  onAction={() => openForm('recebimento')}
                >
                  <span className="inline-flex items-center gap-2">
                    <IconArrowUp size={15} className="text-success" /> Recebimento
                  </span>
                </Dropdown.Item>
                <Dropdown.Item
                  textValue="Despesa"
                  onAction={() => openForm('despesa')}
                >
                  <span className="inline-flex items-center gap-2">
                    <IconArrowDown size={15} className="text-danger" /> Despesa
                  </span>
                </Dropdown.Item>
                <Dropdown.Item textValue="Vale" onAction={() => openForm('vale')}>
                  <span className="inline-flex items-center gap-2">
                    <IconWallet size={15} className="text-primary" /> Vale
                  </span>
                </Dropdown.Item>
                <Dropdown.Item
                  textValue="Transferência"
                  onAction={() => openForm('transferencia')}
                >
                  <span className="inline-flex items-center gap-2">
                    <IconRepeat size={15} className="text-gold-strong" /> Transferência
                  </span>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </div>

      {/* Busca: sempre visível no mobile (Belasis "Digite para buscar");
          revelada com animação via "Buscar" no desktop. Fica SEMPRE montada;
          largura/opacity animam 0 ↔ pleno. */}
      <div
        className={[
          'mb-4 w-full max-w-xl',
          'md:origin-left md:overflow-hidden',
          'md:transition-[width,opacity,transform] md:duration-300 md:ease-[cubic-bezier(0.22,1,0.36,1)]',
          searchOpen
            ? 'md:w-full md:translate-x-0 md:opacity-100'
            : 'md:pointer-events-none md:w-0 md:-translate-x-3 md:opacity-0',
        ].join(' ')}
      >
        <TextField value={query} onChange={setQuery} aria-label="Buscar transações">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <IconSearch size={16} />
            </span>
            <Input placeholder="Digite para buscar" className="pl-9" />
          </div>
        </TextField>
      </div>

      {/* Totais sob demanda (botão "Calcular totais", como no Belasis) */}
      {showTotals && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TotalCard
            icon={<IconArrowUp size={16} />}
            label="Receitas"
            help="Entradas de caixa no período filtrado"
            value={formatMoney(totals.income)}
            tone="success"
          />
          <TotalCard
            icon={<IconArrowDown size={16} />}
            label="Despesas"
            help="Saídas de caixa no período filtrado"
            value={formatMoney(totals.expense)}
            tone="danger"
          />
          <TotalCard
            icon={<IconWallet size={16} />}
            label="Saldo filtrado"
            help="Receitas menos despesas do período filtrado"
            value={formatMoney(totals.balance)}
            tone="accent"
          />
        </div>
      )}

      {/* Pílula "Ordenado por data" do Belasis — visível no mobile.
          O servidor ordena por data (fixo), então é apresentação. */}
      <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-[color:var(--sp-primary,#505afb)] px-4 py-2 text-sm font-semibold text-white shadow-sm md:hidden">
        Ordenado por data
        <IconChevron size={16} />
      </div>

      {/* Contador (mobile visível abaixo do chip; desktop dentro do Card). */}
      <div className="mb-3 flex items-center justify-between md:hidden">
        <span className="text-xs text-muted">
          {total > 0 ? `${total} no total` : '0 lançamento(s)'}
        </span>
      </div>

      {/* DESKTOP: filtro lateral (desliza da esquerda) + Card/DataTable + paginação */}
      <div className="lg:flex lg:items-start lg:gap-4">
        <FilterAside open={filterOpen} desktopOnly breakpoint="lg">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Filtros</span>
            <IconTip label="Fechar filtros">
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                aria-label="Fechar filtros"
                className="rounded-md p-1 text-muted transition-colors hover:bg-cream hover:text-foreground"
              >
                <IconX size={16} />
              </button>
            </IconTip>
          </div>
          <FiltrosBody
            from={from}
            to={to}
            setFrom={setFrom}
            setTo={setTo}
            kindFilter={kindFilter}
            setKindFilter={setKindFilter}
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
          />
          <div className="mt-4 flex flex-col gap-2">
            {filtrosFooter(hasFilters, clearFilters, () => setFilterOpen(false))}
          </div>
        </FilterAside>
        <div className="hidden min-w-0 flex-1 md:block">
        {/* Card = div sem padding próprio (padrão ClientesPage/ProdutosPage): a
            paginação vira irmã da DataTable, no fluxo do scroll do <main>, e pode
            grudar no rodapé (md:sticky) hugando o canto arredondado do card. */}
        <div className={`overflow-clip rounded-2xl ${CARD_CLASS}`}>
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-muted">Ordenado por data</span>
              <span className="text-xs text-muted">
                {total > 0 ? `${total} no total` : '0 lançamento(s)'}
              </span>
            </div>
            {transactions.isLoading ? (
              <TableSkeleton
                columns={9}
                withCheckbox={false}
                firstColAvatar={false}
                card={false}
                variant="desktop"
              />
            ) : transactions.isError ? (
              <ErrorState onRetry={() => transactions.refetch()} />
            ) : visibleRows.length === 0 ? (
              <EmptyState
                icon={<IconDollar size={32} />}
                title={q ? 'Nenhum item encontrado' : hasFilters ? 'Nenhuma transação para os filtros' : 'Nenhuma transação registrada'}
                description={q ? 'Ajuste a busca para ver mais lançamentos.' : hasFilters ? 'Ajuste os filtros para ver mais lançamentos.' : 'Lance recebimentos e despesas para acompanhar o caixa.'}
              />
            ) : (
              <DataTable
                columns={columns}
                rows={visibleRows}
                getKey={(t) => t.id}
                aria-label="Transações"
                rowClassName={(t) =>
                  t.status === 'reversed'
                    ? 'opacity-60'
                    : t.kind === 'income'
                      ? 'bg-success/5'
                      : 'bg-danger/5'
                }
              />
            )}
          </div>
          {/* Rodapé/paginação: fundo sólido (bg-warm-white = bg do card) pra cobrir
              as linhas ao rolar; sticky no rodapé do scroll do <main>. */}
          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-soft-border)] bg-warm-white px-4 pt-3 pb-6 md:sticky md:bottom-0 md:z-20 md:rounded-b-2xl">
              <span className="text-xs text-muted">{total} no total</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" aria-label="Página anterior" isDisabled={page <= 1 || transactions.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <IconChevron size={14} className="rotate-90" />
                </Button>
                <span className="px-1 text-xs text-muted">Página {page} de {pageCount}</span>
                <Button variant="outline" size="sm" aria-label="Próxima página" isDisabled={page >= pageCount || transactions.isFetching} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                  <IconChevron size={14} className="-rotate-90" />
                </Button>
                <span className="ml-1 hidden text-xs text-muted sm:inline">{PAGE_SIZE} / página</span>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* MOBILE: lista direto no fluxo, SEM Card wrapper (regra do projeto) */}
      <div className="md:hidden">
        {transactions.isLoading ? (
          <TableSkeleton variant="mobile" />
        ) : transactions.isError ? (
          <ErrorState onRetry={() => transactions.refetch()} />
        ) : visibleRows.length === 0 ? (
          <EmptyState
            icon={<IconDollar size={32} />}
            title={q ? 'Nenhum item encontrado' : hasFilters ? 'Nenhuma transação para os filtros' : 'Nenhuma transação registrada'}
            description={q ? 'Ajuste a busca para ver mais lançamentos.' : hasFilters ? 'Ajuste os filtros para ver mais lançamentos.' : 'Lance recebimentos e despesas para acompanhar o caixa.'}
          />
        ) : (
          <>
            {/* Mobile: cards Belasis — fundo tingido (verde=receita, vermelho=despesa),
                3 linhas: (1) data + pill status; (2) método + valor preto bold;
                (3) NOME bold + descrição/referência abaixo. Toque abre edição. */}
            <ul className="flex flex-col gap-1.5">
              {visibleRows.map((t) => {
                const isIncome = t.kind === 'income';
                const reversed = t.status === 'reversed';
                const method = t.paymentMethod?.name ?? '—';
                const desc = describe(t);
                const holder = titular(t);
                const isChecked = sel.isSelected(t.id);
                const tint = reversed
                  ? 'bg-white border-[var(--color-soft-border)]'
                  : isIncome
                    ? 'bg-[color-mix(in_oklab,#22c55e_10%,white)] border-[color-mix(in_oklab,#22c55e_20%,var(--color-soft-border))]'
                    : 'bg-[color-mix(in_oklab,#ef4444_8%,white)] border-[color-mix(in_oklab,#ef4444_18%,var(--color-soft-border))]';
                const handleActivate = () => {
                  if (reversed) return;
                  if (sel.selectMode) sel.toggle(t.id);
                  else openEdit(t);
                };
                // Card compacto de 2 linhas (densidade Belasis): (1) data à esquerda
                // + pill status à direita; (2) NOME/titular à esquerda + valor à
                // direita. Método/descrição vão pro drawer de edição.
                // Toggle Pago/Pendente removido do card — mover pra menu/detalhe.
                return (
                  <li key={t.id}>
                    <div
                      role="button"
                      tabIndex={reversed ? -1 : 0}
                      aria-disabled={reversed}
                      aria-pressed={sel.selectMode ? isChecked : undefined}
                      onClick={handleActivate}
                      onKeyDown={(e) => {
                        if (reversed) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleActivate();
                        }
                      }}
                      className={[
                        'flex w-full items-stretch gap-2 rounded-xl border px-2.5 py-2 text-left shadow-[var(--shadow-soft)] transition-colors',
                        tint,
                        reversed ? 'opacity-60' : 'cursor-pointer',
                        sel.selectMode && isChecked ? 'ring-2 ring-primary/60' : '',
                      ].join(' ')}
                    >
                      {sel.selectMode && !reversed && (
                        <AnimatedCheckbox checked={isChecked} className="mt-0.5" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        {/* linha 1: data + pill status */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11.5px] font-medium text-muted-ink">
                            {formatDateBR(t.dueDate)}
                          </span>
                          <Chip variant="soft" color={STATUS_COLOR[t.status]} size="sm">
                            {STATUS_LABEL[t.status]}
                          </Chip>
                        </div>
                        {/* linha 2: NOME/titular à esquerda + valor à direita.
                            Descrição secundária cabe abaixo do nome (truncada). */}
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold text-foreground">
                              {holder || method}
                            </div>
                            {desc && desc !== holder && (
                              <div className="truncate text-[11px] leading-snug text-muted-ink">
                                {desc}
                              </div>
                            )}
                          </div>
                          <span
                            className={[
                              'shrink-0 text-[14px] font-bold tabular-nums',
                              reversed ? 'line-through text-foreground' : isIncome ? 'text-success' : 'text-danger',
                            ].join(' ')}
                          >
                            {isIncome ? '+' : '−'}{formatMoney(t.grossAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {/* Mobile: "Ver mais" — avança para a próxima página. */}
            {total > 0 && page < pageCount && (
              <div className="mt-3">
                <Button
                  variant="outline"
                  className="w-full"
                  isDisabled={transactions.isFetching}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  {transactions.isFetching ? 'Carregando…' : 'Ver mais'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filtrar mobile: bottom-sheet com as seções do Belasis (no desktop é o FilterAside acima). */}
      {isMobile && (
        <FiltrosDrawer
          isOpen={filterOpen}
          onClose={() => setFilterOpen(false)}
          from={from}
          to={to}
          setFrom={setFrom}
          setTo={setTo}
          kindFilter={kindFilter}
          setKindFilter={setKindFilter}
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
      )}

      {/* Bottom-sheet das ações em lote do modo de seleção (mobile + desktop). */}
      <BulkActionsSheet
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        actions={bulkActions}
        count={sel.count}
      />

      {formMode === 'transferencia' ? (
        <TransferenciaModal isOpen onClose={closeForm} />
      ) : formMode ? (
        <LancamentoModal
          mode={formMode}
          editing={editing}
          onClose={closeForm}
          onReverse={
            editing && editing.status !== 'reversed'
              ? async () => {
                  const t = editing;
                  closeForm();
                  await handleReverse(t);
                }
              : undefined
          }
          isReversing={reverse.isPending}
        />
      ) : null}

      {/* FAB chat mobile removido: as ações principais vivem na BottomNav
          (Filtros · Totais · Selecionar · Criar) e o FAB duplicava affordance
          + colidia com a barra inferior. Retomar quando o chat de suporte
          real for integrado. */}
    </div>
  );
}

type FiltrosProps = {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  kindFilter: 'all' | TransactionKind;
  setKindFilter: (v: 'all' | TransactionKind) => void;
  statusFilter: 'all' | 'paid' | 'pending';
  setStatusFilter: (v: 'all' | 'paid' | 'pending') => void;
  methodFilter: string;
  setMethodFilter: (v: string) => void;
  paymentMethods: { id: string; name: string }[];
  showReversed: boolean;
  setShowReversed: (v: boolean) => void;
};

/**
 * Corpo do filtro (Belasis "Filtrar") com as seções Período, Status de
 * pagamento, Formas de pagamento e Estornadas. Compartilhado entre o painel
 * lateral desktop (FilterAside) e o bottom-sheet mobile (Drawer).
 */
function FiltrosBody({
  from,
  to,
  setFrom,
  setTo,
  kindFilter,
  setKindFilter,
  statusFilter,
  setStatusFilter,
  methodFilter,
  setMethodFilter,
  paymentMethods,
  showReversed,
  setShowReversed,
}: FiltrosProps) {
  const statusOptions: { id: 'all' | 'paid' | 'pending'; name: string }[] = [
    { id: 'all', name: 'Todos' },
    { id: 'paid', name: 'Pago' },
    { id: 'pending', name: 'Em aberto' },
  ];
  const methodOptions = [{ id: ALL, name: 'Todas as formas' }, ...paymentMethods];

  return (
    <div className="flex flex-col gap-6">
      <FilterSection title="Tipo">
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'all' as const, name: 'Todos' },
            { id: 'income' as const, name: 'Receitas' },
            { id: 'expense' as const, name: 'Despesas' },
          ].map((option) => {
            const active = kindFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setKindFilter(option.id)}
                className={`h-9 rounded-lg border px-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-transparent bg-gold text-[var(--color-on-gold,#3a2f16)]'
                    : 'border-[var(--color-soft-border)] bg-white text-foreground hover:bg-cream'
                }`}
              >
                {option.name}
              </button>
            );
          })}
        </div>
      </FilterSection>

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
          <span className="inline-flex items-center text-sm text-foreground">
            Mostrar estornadas
            <HelpTooltip>Incluir transações canceladas/estornadas na listagem</HelpTooltip>
          </span>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </FilterSection>
    </div>
  );
}

function filtrosFooter(hasFilters: boolean, onClear: () => void, onApply: () => void) {
  return (
    <>
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        isDisabled={!hasFilters}
        onClick={onClear}
      >
        Limpar filtros
      </Button>
      <Button variant="primary" className="w-full sm:w-auto" onClick={onApply}>
        Aplicar
      </Button>
    </>
  );
}

/**
 * Bottom-sheet "Filtrar" (mobile) com as seções do Belasis. No desktop o mesmo
 * conteúdo vive no FilterAside lateral (desliza da esquerda da tabela).
 */
function FiltrosDrawer({
  isOpen,
  onClose,
  hasFilters,
  onClear,
  ...body
}: FiltrosProps & {
  isOpen: boolean;
  onClose: () => void;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Filtrar"
      footer={filtrosFooter(hasFilters, onClear, onClose)}
      widthClass="sm:w-[420px]"
      placement="bottom"
    >
      <FiltrosBody {...body} />
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
  help,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  help?: string;
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
          <span className="inline-flex items-center text-sm font-medium text-muted">
            {label}
            {help ? <HelpTooltip>{help}</HelpTooltip> : null}
          </span>
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
export function LancamentoModal({
  mode,
  editing,
  onClose,
  onReverse,
  isReversing,
}: {
  mode: LancamentoMode;
  editing: TransactionRow | null;
  onClose: () => void;
  onReverse?: () => void;
  isReversing?: boolean;
}) {
  const isVale = mode === 'vale';
  const kind: TransactionKind = mode === 'recebimento' ? 'income' : 'expense';

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [partyId, setPartyId] = useState('');
  // Numa despesa o titular pode ser fornecedor (padrão) ou profissional.
  const [despesaPartyKind, setDespesaPartyKind] = useState<'supplier' | 'professional'>(
    'supplier',
  );
  const [status, setStatus] = useState<PaymentStatus>('paid');
  const [dueDate, setDueDate] = useState(() => isoDate(new Date()));
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Menu vertical estilo Belasis: agrupa os campos por afinidade.
  const [section, setSection] = useState<'dados' | 'classificacao' | 'observacoes'>(
    'dados',
  );

  const categories = useFinancialCategories();
  const paymentMethods = usePaymentMethods();
  const accounts = useFinancialAccounts();
  const customers = useCustomers('', 1, 50);
  const professionals = useProfessionals(1, 50);
  const suppliers = useSuppliers();
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
    setSection('dados');
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
            partyType:
              mode === 'recebimento'
                ? 'customer'
                : mode === 'despesa'
                  ? despesaPartyKind
                  : 'professional',
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
      {/* Estornar aparece à esquerda quando editando (equivalente ao "Excluir"
          do padrão canônico — transação não se apaga, se estorna). */}
      {onReverse && (
        <Button
          variant="ghost"
          className="w-full text-danger sm:mr-auto sm:w-auto"
          isDisabled={isReversing || isPending}
          onClick={onReverse}
        >
          <IconRepeat size={16} /> {isReversing ? 'Estornando…' : 'Estornar'}
        </Button>
      )}
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
    <FullDrawer
      isOpen
      onClose={onClose}
      title={title}
      widthClass="sm:w-[520px]"
      sections={[
        { key: 'dados', label: 'Dados do lançamento' },
        { key: 'classificacao', label: 'Categoria & Conta' },
        { key: 'observacoes', label: 'Observações' },
      ]}
      activeSection={section}
      onSectionChange={(k) => setSection(k as 'dados' | 'classificacao' | 'observacoes')}
      footer={footer}
    >
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
        <div className="flex flex-col gap-4 max-w-3xl">
          {/* SEÇÃO 1: Dados do lançamento — Valor, Vencimento, Titular, Status. */}
          {section === 'dados' && (
            <>
              {/* 1. Valor */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Valor (R$)</label>
                <TextField value={amount} onChange={setAmount} aria-label="Valor">
                  <Input placeholder="0,00" inputMode="decimal" />
                </TextField>
              </div>

              {/* 2. Vencimento (dd/mm/aaaa) */}
              <DateFieldBR
                label="Vencimento"
                value={dueDate}
                onChange={setDueDate}
                className="min-w-0"
              />

              {/* 3. Titular: cliente (recebimento) ou profissional (vale/despesa) */}
              {mode === 'recebimento' && (
                <FieldSelect
                  label="Recebido de (cliente)"
                  placeholder="Selecione (opcional)"
                  value={partyId}
                  onChange={setPartyId}
                  options={(customers.data?.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
                />
              )}
              {isVale && (
                <FieldSelect
                  label="Profissional (obrigatório)"
                  placeholder="Selecione"
                  value={partyId}
                  onChange={setPartyId}
                  options={(professionals.data?.data ?? []).map((p) => ({ id: p.id, name: p.name }))}
                />
              )}
              {/* Despesa: o titular natural é o FORNECEDOR (compra de produto,
                  material, serviço de terceiro). Antes a tela só oferecia
                  profissional, então não dava para registrar a quem se pagou.
                  O backend já aceita partyType 'supplier'. */}
              {mode === 'despesa' && (
                <>
                  <FieldSelect
                    label="Pago para"
                    placeholder="Selecione"
                    value={despesaPartyKind}
                    onChange={(v) => {
                      setDespesaPartyKind(v as 'supplier' | 'professional');
                      setPartyId('');
                    }}
                    options={[
                      { id: 'supplier', name: 'Fornecedor' },
                      { id: 'professional', name: 'Profissional' },
                    ]}
                  />
                  <FieldSelect
                    label={
                      despesaPartyKind === 'supplier'
                        ? 'Fornecedor / representante'
                        : 'Profissional'
                    }
                    placeholder="Selecione (opcional)"
                    value={partyId}
                    onChange={setPartyId}
                    options={
                      despesaPartyKind === 'supplier'
                        ? (suppliers.data?.data ?? []).map((s) => ({ id: s.id, name: s.name }))
                        : (professionals.data?.data ?? []).map((p) => ({ id: p.id, name: p.name }))
                    }
                  />
                </>
              )}

              {/* 4. Status */}
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
            </>
          )}

          {/* SEÇÃO 2: Categoria & Conta — Forma de pagamento, Conta, Categoria. */}
          {section === 'classificacao' && (
            <>
              <FieldSelect
                label="Forma de pagamento"
                placeholder="Selecione (opcional)"
                value={paymentMethodId}
                onChange={setPaymentMethodId}
                options={(paymentMethods.data ?? []).map((m) => ({ id: m.id, name: m.name }))}
              />

              <FieldSelect
                label="Conta"
                placeholder="Selecione (opcional)"
                value={accountId}
                onChange={setAccountId}
                options={(accounts.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
              />

              {/* Categoria (oculto no vale — vale não é categorizável). */}
              {!isVale && (
                <FieldSelect
                  label="Categoria"
                  placeholder="Selecione (opcional)"
                  value={categoryId}
                  onChange={setCategoryId}
                  options={(categories.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
                />
              )}
            </>
          )}

          {/* SEÇÃO 3: Observações — Descrição do lançamento. */}
          {section === 'observacoes' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Descrição</label>
              <TextField value={description} onChange={setDescription} aria-label="Descrição">
                <Input placeholder="Gerada automaticamente se vazio" />
              </TextField>
              <p className="text-xs text-muted">
                Se em branco, será preenchida automaticamente com base no tipo de
                lançamento e no titular selecionado.
              </p>
            </div>
          )}

          {formError && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </div>
          )}
        </div>
      )}
    </FullDrawer>
  );
}

/** Transferência entre contas (gera um par de lançamentos). */
export function TransferenciaModal({
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
      widthClass="sm:w-[520px]"
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
