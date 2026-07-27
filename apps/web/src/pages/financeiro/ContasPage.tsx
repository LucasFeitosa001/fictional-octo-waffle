import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Chip, Input, ListBox, Select, Switch, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import type { Column } from '../../components/DataTable';
import { AppTabs } from '../../components/AppTabs';
import { EmptyState } from '../../components/States';
import { TableSkeleton } from '../../components/Skeletons';
import { Drawer } from '../../components/Drawer';
import { IconTip } from '../../components/IconTip';
import { useConfirm } from '../../components/ConfirmDialog';
import { HelpTooltip } from '../../components/HelpTooltip';
import {
  IconCheck,
  IconChevron,
  IconCreditCard,
  IconDollar,
  IconFilter,
  IconX,
  IconFolder,
  IconLayers,
  IconPencil,
  IconPlay,
  IconPlus,
  IconSearch,
  IconTrash,
  IconWallet,
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
import { AnimatedCheckbox } from '../../components/AnimatedCheckbox';
import { BulkActionsSheet } from '../../components/BulkActionsSheet';
import { useSelectMode, buildSelectActions, type BulkAction } from '../../hooks/useSelectMode';
import { FilterAside } from '../../components/FilterAside';
import { FilterCheckbox } from '../../components/FilterCheckbox';
import { useIsMobile } from '../../hooks/useIsMobile';

const PAGE_SIZE = 20;

const CARD_CLASS =
  'border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]';

const ACCOUNT_TYPE_LABEL: Record<FinancialAccountType, string> = {
  cash: 'Caixa',
  bank: 'Banco',
};

const CATEGORY_KIND_LABEL: Record<FinancialCategoryKind, string> = {
  credit: 'Crédito',
  debit: 'Débito',
};

// Tipo da forma de pagamento (Belasis: dinheiro|cartao|pix|...). Só apresentação;
// o backend guarda a string livre em PaymentMethod.kind.
const METHOD_KIND_OPTIONS: { id: string; label: string }[] = [
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'pix', label: 'Pix' },
  { id: 'credito', label: 'Cartão de crédito' },
  { id: 'debito', label: 'Cartão de débito' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'transferencia', label: 'Transferência' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'outros', label: 'Outros' },
];

type TabKey = 'contas' | 'formas' | 'categorias';

// Abas do Belasis (Contas · Formas de pagamento · Categorias). No mobile o
// Belasis empilha ícone acima do rótulo (bank/dollar/profile → wallet/dollar/
// layers); no desktop mantém underline de texto puro.
const TABS: { id: TabKey; label: string; icon: React.ReactNode }[] = [
  { id: 'contas', label: 'Contas', icon: <IconWallet size={16} /> },
  { id: 'formas', label: 'Formas de pagamento', icon: <IconDollar size={16} /> },
  { id: 'categorias', label: 'Categorias', icon: <IconLayers size={16} /> },
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
      <IconTip label="Editar">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Editar"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-cream hover:text-foreground"
        >
          <IconPencil size={16} />
        </button>
      </IconTip>
      <span className="h-4 w-px bg-[var(--color-soft-border)]" aria-hidden />
      <IconTip label="Remover">
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          aria-label="Remover"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
        >
          <IconTrash size={16} />
        </button>
      </IconTip>
    </div>
  );
}

function FinancialDesktopTable<T>({
  ariaLabel,
  columns,
  rows,
  getKey,
}: {
  ariaLabel: string;
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table aria-label={ariaLabel} className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="bg-canvas">
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={[
                  'h-11 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-ink',
                  column.key === 'actions' ? 'w-24 text-right' : '',
                ].join(' ')}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr
              key={getKey(row)}
              className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--sp-primary)_4%,var(--color-card))]"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={[
                    'h-14 px-4 align-middle text-foreground',
                    column.key === 'actions' ? 'text-right' : '',
                    column.className ?? '',
                  ].join(' ')}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Card mobile 2 linhas: dot de status + nome/subtítulo + ações lápis/lixeira.
 * Substitui a DataTable no mobile — segue o padrão validado em ComandasPage.
 *
 * Em selectMode: exibe checkbox no lugar do dot, ações inline ficam ocultas
 * e o tap no card alterna a seleção (padrão Belasis / ComandasPage).
 * showInlineActions=false esconde as ações mesmo fora do selectMode — usado
 * nas abas onde a edição vem via tap simples no card (Contas / Categorias).
 */
function MobileRowCard({
  active,
  name,
  subtitle,
  onEdit,
  onRemove,
  removing,
  dim,
  selectMode,
  selected,
  onToggleSelect,
  showInlineActions = true,
}: {
  active: boolean;
  name: string;
  subtitle: string;
  onEdit: () => void;
  onRemove: () => void;
  removing?: boolean;
  dim?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  showInlineActions?: boolean;
}) {
  const handleTap = () => {
    if (selectMode) onToggleSelect?.();
    else onEdit();
  };
  const isSelectable = selectMode || !showInlineActions;
  const content = (
    <>
      {selectMode ? (
        <AnimatedCheckbox checked={!!selected} />
      ) : (
        <span
          aria-hidden
          className={
            'h-2.5 w-2.5 shrink-0 rounded-full ' +
            (active ? 'bg-emerald-500' : 'bg-gray-300')
          }
        />
      )}
      <div className="min-w-0 flex-1">
        <div
          className={
            'truncate text-sm font-medium ' + (dim ? 'text-muted' : 'text-foreground')
          }
        >
          {name}
        </div>
        <div className="truncate text-xs text-muted">{subtitle}</div>
      </div>
      {showInlineActions && !selectMode && (
        <RowActions onEdit={onEdit} onRemove={onRemove} removing={removing} />
      )}
    </>
  );

  const baseClass =
    'flex w-full items-center gap-3 border-b border-[var(--color-soft-border)] px-3 py-3 text-left last:border-b-0 transition-colors ' +
    (selected
      ? 'bg-[color-mix(in_oklab,var(--sp-primary,#505afb)_5%,white)] ring-1 ring-inset ring-[color:var(--sp-primary,#505afb)]'
      : 'active:bg-[color-mix(in_oklab,var(--sp-primary,#505afb)_4%,white)]');

  return (
    <li>
      {isSelectable ? (
        <button type="button" onClick={handleTap} className={baseClass}>
          {content}
        </button>
      ) : (
        <div className={baseClass}>{content}</div>
      )}
    </li>
  );
}

export function ContasPage({ defaultTab }: { defaultTab?: TabKey } = {}) {
  // Sincroniza aba com querystring (?tab=contas|formas|categorias) para
  // deep-link e "voltar" preservar contexto. Se veio via rota dedicada
  // (defaultTab prop) e não há ?tab= na URL, aplica o defaultTab e sincroniza
  // o querystring para manter consistência de deep-link.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = ((): TabKey => {
    const t = searchParams.get('tab');
    if (t === 'formas' || t === 'categorias' || t === 'contas') return t;
    return defaultTab ?? 'contas';
  })();
  const [tab, setTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    if (defaultTab && !searchParams.get('tab')) {
      const nextParams = new URLSearchParams(searchParams);
      if (defaultTab === 'contas') nextParams.delete('tab');
      else nextParams.set('tab', defaultTab);
      setSearchParams(nextParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [page, setPage] = useState(1);

  // Toolbar do Belasis: Buscar (input revelado) · Filtrar (drawer lateral) · Novo.
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const isMobile = useIsMobile();

  // Ordenação por nome — pílula "Ordenando por Nome" do mobile (Belasis).
  // Alterna asc/desc mantendo a ordenação por nome (só apresentação).
  const [sortAsc, setSortAsc] = useState(true);

  // Filtro de Status do Belasis: caixas "Ativada" / "Desativada". Padrão do
  // Belasis é mostrar apenas as ativadas.
  const [showActive, setShowActive] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Modo Selecionar (mobile) para contas/categorias — padrão Belasis via infra
  // compartilhada (useSelectMode): ativado pela BottomNav; oculta ações inline e
  // transforma o card em alvo de seleção com checkbox. `sel` é montado abaixo,
  // depois que os ids visíveis da aba atual existem. Formas mantém ações inline.
  const [actionsOpen, setActionsOpen] = useState(false);

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

  // Status vale nas TRÊS abas: PaymentMethod também tem `active` no schema (e o
  // front já filtra por ele em TransacoesPage). Antes a aba Formas era exceção e
  // a ação "Filtrar" sumia da barra inferior, que encolhia de 4 para 2 botões e
  // "pulava" ao trocar de aba. Ver .claude/studies/14.
  const supportsStatus = true;

  const filteredAccounts = useMemo(() => {
    const r = allAccounts.filter((a) => matchActive(a.active) && matchSearch(a.name)).sort(byName);
    return sortAsc ? r : r.reverse();
  }, [allAccounts, showActive, showInactive, q, sortAsc]);
  const filteredCategories = useMemo(() => {
    const r = allCategories
      .filter((c) => matchActive(c.active) && matchSearch(c.name))
      .sort(byName);
    return sortAsc ? r : r.reverse();
  }, [allCategories, showActive, showInactive, q, sortAsc]);
  const filteredMethods = useMemo(() => {
    const r = allMethods.filter((m) => matchSearch(m.name)).sort(byName);
    return sortAsc ? r : r.reverse();
  }, [allMethods, q, sortAsc]);

  // Qualquer mudança de aba/busca/filtro volta para a primeira página.
  useEffect(() => {
    setPage(1);
  }, [tab, q, showActive, showInactive]);

  const delAccount = useDeleteFinancialAccount();
  const delMethod = useDeletePaymentMethod();
  const delCategory = useDeleteFinancialCategory();
  const confirm = useConfirm();

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
    const ok = await confirm({
      title: `Excluir conta "${a.name}"?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await delAccount.mutateAsync(a.id);
    } catch (err) {
      await confirm({
        title: 'Não foi possível',
        message: err instanceof ApiClientError ? err.message : 'Não foi possível remover a conta.',
        confirmLabel: 'OK',
        cancelLabel: undefined,
        danger: false,
      });
    }
  }
  async function removeMethod(m: PaymentMethod) {
    const ok = await confirm({
      title: `Excluir forma "${m.name}"?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await delMethod.mutateAsync(m.id);
    } catch (err) {
      await confirm({
        title: 'Não foi possível',
        message: err instanceof ApiClientError ? err.message : 'Não foi possível remover a forma.',
        confirmLabel: 'OK',
        cancelLabel: undefined,
        danger: false,
      });
    }
  }
  async function removeCategory(c: FinancialCategory) {
    const ok = await confirm({
      title: `Excluir categoria "${c.name}"?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await delCategory.mutateAsync(c.id);
    } catch (err) {
      await confirm({
        title: 'Não foi possível',
        message:
          err instanceof ApiClientError ? err.message : 'Não foi possível remover a categoria.',
        confirmLabel: 'OK',
        cancelLabel: undefined,
        danger: false,
      });
    }
  }

  const accountColumns: Column<FinancialAccount>[] = [
    {
      key: 'name',
      header: 'Nome',
      isRowHeader: true,
      render: (a) => (
        <span className={a.active ? 'font-medium text-primary hover:underline' : 'font-medium text-muted'}>
          {a.name}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Detalhes',
      // Belasis mostra o detalhe como texto simples (ex.: "Caixa"), sem chip.
      render: (a) => <span className="text-foreground">{ACCOUNT_TYPE_LABEL[a.type]}</span>,
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
      render: (m) => <span className="font-medium text-primary hover:underline">{m.name}</span>,
    },
    {
      key: 'fee',
      header: (
        <span className="inline-flex items-center">
          Taxa
          <HelpTooltip>Percentual retido pela operadora sobre o valor recebido</HelpTooltip>
        </span>
      ),
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
      header: (
        <span className="inline-flex items-center">
          Prazo de recebimento
          <HelpTooltip>Dias até o valor cair na conta após o pagamento</HelpTooltip>
        </span>
      ),
      render: (m) =>
        m.settlementDays > 0
          ? `${m.settlementDays} dia${m.settlementDays === 1 ? '' : 's'}`
          : 'À vista',
    },
    {
      key: 'cash',
      header: (
        <span className="inline-flex items-center">
          Baixa no financeiro
          <HelpTooltip>Se a transação entra no financeiro automaticamente</HelpTooltip>
        </span>
      ),
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
        <span className={c.active ? 'font-medium text-primary hover:underline' : 'font-medium text-muted'}>
          {c.name}
        </span>
      ),
    },
    {
      key: 'kind',
      header: (
        <span className="inline-flex items-center">
          Crédito/Débito
          <HelpTooltip>Crédito = entrada de dinheiro; Débito = saída</HelpTooltip>
        </span>
      ),
      render: (c) => (
        <Chip variant="soft" color={c.kind === 'credit' ? 'success' : 'danger'} size="sm">
          {CATEGORY_KIND_LABEL[c.kind]}
        </Chip>
      ),
    },
    {
      key: 'commission',
      header: (
        <span className="inline-flex items-center">
          Comissionável
          <HelpTooltip>Se lançamentos desta categoria entram no cálculo de comissão</HelpTooltip>
        </span>
      ),
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

  // Modo de seleção (infra compartilhada): opera sobre os ids VISÍVEIS da aba
  // atual (página corrente). "Selecionar todos" marca todos os itens visíveis.
  const selectableIds = useMemo(() => {
    if (tab === 'contas') return pageAccounts.map((a) => a.id);
    if (tab === 'formas') return pageMethods.map((m) => m.id);
    return pageCategories.map((c) => c.id);
  }, [tab, pageAccounts, pageMethods, pageCategories]);
  const sel = useSelectMode(selectableIds);

  // Ao trocar de aba, sai do modo e limpa a seleção (padrão Belasis).
  useEffect(() => {
    sel.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Hook de exclusão da aba atual (contas/categorias suportam seleção em lote;
  // formas mantém ações inline). Excluir em lote chama o mutateAsync existente
  // para cada id selecionado em Promise.all, após confirmação.
  const activeDelete =
    tab === 'contas' ? delAccount : tab === 'formas' ? delMethod : delCategory;
  const bulkActions: BulkAction[] = [
    {
      key: 'delete',
      label: 'Excluir selecionados',
      danger: true,
      icon: <IconTrash size={18} />,
      disabled: activeDelete.isPending,
      onClick: async () => {
        const ok = await confirm({
          title: 'Excluir selecionados?',
          message: `Excluir ${sel.count} ${sel.count === 1 ? 'item selecionado' : 'itens selecionados'}? Essa ação não pode ser desfeita.`,
          confirmLabel: 'Excluir',
          danger: true,
        });
        if (!ok) return;
        try {
          await Promise.all([...sel.selected].map((id) => activeDelete.mutateAsync(id)));
          setActionsOpen(false);
          sel.cancel();
        } catch (err) {
          await confirm({
            title: 'Não foi possível',
            message:
              err instanceof ApiClientError
                ? err.message
                : 'Não foi possível excluir os itens selecionados.',
            confirmLabel: 'OK',
            cancelLabel: undefined,
            danger: false,
          });
        }
      },
    },
  ];

  // Belasis rotula o botão de criação sempre como "Novo" (independente da aba).
  const newLabel = 'Novo';

  // Badge de filtros ativos: desvios do padrão do Belasis (só Ativada).
  const statusFilterCount =
    (showInactive ? 1 : 0) + (!showActive ? 1 : 0);

  function changeTab(next: TabKey) {
    setTab(next);
    setSearch('');
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'contas') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setSearchParams(nextParams, { replace: true });
  }

  // Mobile: BottomNav do Belasis = Filtros · Selecionar · Novo. A busca fica
  // sempre visível no topo (Belasis), então não há ação "Buscar". Selecionar
  // Seleção vale nas três abas: selectableIds já devolve os ids das
  // formas de pagamento (ver acima), então a infra de selectMode já cobre a aba.
  // Manter as mesmas ações em todas evita a barra inferior mudar de tamanho.
  const supportsSelectMode = true;
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
          ...(supportsStatus
            ? [
                {
                  key: 'filtrar',
                  label: 'Filtrar',
                  icon: <IconFilter size={22} />,
                  onClick: () => setFilterOpen((v) => !v),
                },
              ]
            : []),
          ...(supportsSelectMode
            ? [
                {
                  key: 'selecionar',
                  label: 'Selecionar',
                  icon: <IconCheck size={22} />,
                  onClick: sel.enter,
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
    [sel.selectMode, sel.allSelected, sel.count, tab, supportsStatus, supportsSelectMode],
  );

  return (
    <div>
      {/* Cabeçalho + toolbar do Belasis: título à esquerda; à direita
          Buscar · Filtrar · Novo. */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">
            Cadastros
          </h1>
          {/* Botão "assista o tutorial" ao lado do título (play-circle do Belasis) */}
          <span
            aria-hidden
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--sp-primary,#505afb)]/10 text-[color:var(--sp-primary,#505afb)]"
          >
            <IconPlay size={16} className="ml-0.5" />
          </span>
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
              onClick={() => setFilterOpen((v) => !v)}
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

      <AppTabs
        items={TABS}
        selectedKey={tab}
        onSelectionChange={changeTab}
        ariaLabel="Cadastros financeiros"
        className="mb-4"
      />

      {/* Busca: sempre visível no mobile (Belasis); revelada com animação via
          "Buscar" no desktop. Fica SEMPRE montada; largura/opacity animam 0 ↔ pleno. */}
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
        <TextField value={search} onChange={setSearch} aria-label="Buscar">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <IconSearch size={16} />
            </span>
            <Input placeholder="Digite para buscar" className="pl-9" />
          </div>
        </TextField>
      </div>

      {/* Pílula "Ordenando por Nome" do Belasis — visível no mobile. */}
      <button
        type="button"
        onClick={() => setSortAsc((v) => !v)}
        className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-[color:var(--sp-primary,#505afb)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 md:hidden"
      >
        Ordenando por Nome
        <IconChevron size={16} className={sortAsc ? 'rotate-180' : ''} />
      </button>

      {/* DESKTOP: filtro lateral (desliza da esquerda) + Card/DataTable */}
      <div className="md:flex md:items-start md:gap-4">
        {supportsStatus && (
          <FilterAside open={filterOpen} desktopOnly breakpoint="md">
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
            <StatusFilterBody
              showActive={showActive}
              showInactive={showInactive}
              setShowActive={setShowActive}
              setShowInactive={setShowInactive}
            />
            <div className="mt-4 flex flex-col gap-2">
              {statusFilterFooter(setShowActive, setShowInactive, () => setFilterOpen(false))}
            </div>
          </FilterAside>
        )}
        <div className="hidden min-w-0 flex-1 md:block">
        {/* Card = div sem padding próprio (padrão ClientesPage/ProdutosPage): a
            paginação vira irmã da DataTable, no fluxo do scroll do <main>, e pode
            grudar no rodapé (md:sticky) hugando o canto arredondado do card. */}
        <div className={`overflow-hidden rounded-2xl ${CARD_CLASS}`}>
            {tab === 'contas' &&
              (isLoading ? (
                <TableSkeleton columns={4} withCheckbox={false} firstColAvatar={false} card={false} variant="desktop" />
              ) : filteredAccounts.length === 0 ? (
                <EmptyState
                  icon={<IconFolder size={32} />}
                  title="Nenhuma conta encontrada"
                  description="Cadastre caixa ou contas bancárias para registrar movimentações."
                />
              ) : (
                <FinancialDesktopTable
                  ariaLabel="Contas financeiras"
                  columns={accountColumns}
                  rows={pageAccounts}
                  getKey={(a) => a.id}
                />
              ))}

            {tab === 'formas' &&
              (isLoading ? (
                <TableSkeleton columns={4} withCheckbox={false} firstColAvatar={false} card={false} variant="desktop" />
              ) : filteredMethods.length === 0 ? (
                <EmptyState
                  icon={<IconCreditCard size={32} />}
                  title="Nenhuma forma de pagamento"
                  description="Cadastre dinheiro, pix, crédito ou débito com taxa e prazo de recebimento."
                />
              ) : (
                <FinancialDesktopTable
                  ariaLabel="Formas de pagamento"
                  columns={methodColumns}
                  rows={pageMethods}
                  getKey={(m) => m.id}
                />
              ))}

            {tab === 'categorias' &&
              (isLoading ? (
                <TableSkeleton columns={3} withCheckbox={false} firstColAvatar={false} card={false} variant="desktop" />
              ) : filteredCategories.length === 0 ? (
                <EmptyState
                  icon={<IconFolder size={32} />}
                  title="Nenhuma categoria encontrada"
                  description="Organize o plano de contas por categoria de crédito e débito."
                />
              ) : (
                <FinancialDesktopTable
                  ariaLabel="Categorias financeiras"
                  columns={categoryColumns}
                  rows={pageCategories}
                  getKey={(c) => c.id}
                />
              ))}

          {rowCount > 0 && (
            <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t border-line bg-card px-4 py-3">
              <span className="whitespace-nowrap text-xs text-muted">
                {rowCount} registros no total
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Página anterior"
                  isDisabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <IconChevron size={14} className="rotate-90" />
                </Button>
                <span className="whitespace-nowrap px-1 text-xs text-muted">
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
        </div>
        </div>
      </div>

      {/* MOBILE: lista direto no fluxo, SEM Card wrapper (regra do projeto) */}
      <div className="md:hidden">
        {tab === 'contas' &&
          (isLoading ? (
            <TableSkeleton variant="mobile" />
          ) : filteredAccounts.length === 0 ? (
            <EmptyState
              icon={<IconFolder size={32} />}
              title="Nenhuma conta encontrada"
              description="Cadastre caixa ou contas bancárias para registrar movimentações."
            />
          ) : (
            <>
              <ul>
                {pageAccounts.map((a) => (
                  <MobileRowCard
                    key={a.id}
                    active={a.active}
                    dim={!a.active}
                    name={a.name}
                    subtitle={ACCOUNT_TYPE_LABEL[a.type]}
                    onEdit={() => {
                      setEditingAccount(a);
                      setAccountDrawer(true);
                    }}
                    onRemove={() => removeAccount(a)}
                    removing={delAccount.isPending}
                    showInlineActions={false}
                    selectMode={sel.selectMode}
                    selected={sel.isSelected(a.id)}
                    onToggleSelect={() => sel.toggle(a.id)}
                  />
                ))}
              </ul>
              {rowCount > 0 && page < pageCount && (
                <div className="mt-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Ver mais
                  </Button>
                </div>
              )}
            </>
          ))}

        {tab === 'formas' &&
          (isLoading ? (
            <TableSkeleton variant="mobile" />
          ) : filteredMethods.length === 0 ? (
            <EmptyState
              icon={<IconCreditCard size={32} />}
              title="Nenhuma forma de pagamento"
              description="Cadastre dinheiro, pix, crédito ou débito com taxa e prazo de recebimento."
            />
          ) : (
            <>
              <ul>
                {pageMethods.map((m) => {
                  const fee = `${Number(m.feePercent).toFixed(2)}%`;
                  const prazo =
                    m.settlementDays > 0
                      ? `${m.settlementDays} dia${m.settlementDays === 1 ? '' : 's'}`
                      : 'À vista';
                  return (
                    <MobileRowCard
                      key={m.id}
                      active
                      name={m.name}
                      subtitle={`Taxa ${fee} · ${prazo}`}
                      onEdit={() => {
                        setEditingMethod(m);
                        setMethodDrawer(true);
                      }}
                      onRemove={() => removeMethod(m)}
                      removing={delMethod.isPending}
                    />
                  );
                })}
              </ul>
              {/* Contador rodapé mobile — mesma copy da paginação desktop. */}
              <div className="mt-3 px-3 text-xs text-muted">
                {rowCount} {rowCount === 1 ? 'registro' : 'registros'} no total
              </div>
              {rowCount > 0 && page < pageCount && (
                <div className="mt-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Ver mais
                  </Button>
                </div>
              )}
            </>
          ))}

        {tab === 'categorias' &&
          (isLoading ? (
            <TableSkeleton variant="mobile" />
          ) : filteredCategories.length === 0 ? (
            <EmptyState
              icon={<IconFolder size={32} />}
              title="Nenhuma categoria encontrada"
              description="Organize o plano de contas por categoria de crédito e débito."
            />
          ) : (
            <>
              <ul>
                {pageCategories.map((c) => (
                  <MobileRowCard
                    key={c.id}
                    active={c.active}
                    dim={!c.active}
                    name={c.name}
                    subtitle={`${CATEGORY_KIND_LABEL[c.kind]}${c.countsAsCommission ? ' · Comissiona' : ''}`}
                    onEdit={() => {
                      setEditingCategory(c);
                      setCategoryDrawer(true);
                    }}
                    onRemove={() => removeCategory(c)}
                    removing={delCategory.isPending}
                    showInlineActions={false}
                    selectMode={sel.selectMode}
                    selected={sel.isSelected(c.id)}
                    onToggleSelect={() => sel.toggle(c.id)}
                  />
                ))}
              </ul>
              {rowCount > 0 && page < pageCount && (
                <div className="mt-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Ver mais
                  </Button>
                </div>
              )}
            </>
          ))}
      </div>

      {/* Filtrar mobile: bottom-sheet com a seção Status (no desktop é o FilterAside acima). */}
      {isMobile && (
        <StatusFilterDrawer
          isOpen={filterOpen}
          onClose={() => setFilterOpen(false)}
          showActive={showActive}
          showInactive={showInactive}
          setShowActive={setShowActive}
          setShowInactive={setShowInactive}
        />
      )}

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

      {/* Bottom-sheet das ações em lote do modo de seleção (mobile + desktop). */}
      <BulkActionsSheet
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        actions={bulkActions}
        count={sel.count}
      />
    </div>
  );
}

type StatusFilterProps = {
  showActive: boolean;
  showInactive: boolean;
  setShowActive: (v: boolean) => void;
  setShowInactive: (v: boolean) => void;
};

/** Corpo do filtro "Status" (Ativada / Desativada) — compartilhado entre o
 * painel lateral desktop (FilterAside) e o bottom-sheet mobile (Drawer). */
function StatusFilterBody({ showActive, showInactive, setShowActive, setShowInactive }: StatusFilterProps) {
  const options: { label: string; value: boolean; set: (v: boolean) => void }[] = [
    { label: 'Ativada', value: showActive, set: setShowActive },
    { label: 'Desativada', value: showInactive, set: setShowInactive },
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Status</span>
      <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--color-soft-border)]">
        {options.map((o, i) => (
          <FilterCheckbox
            key={o.label}
            checked={o.value}
            onChange={o.set}
            className={
              'gap-3 px-3 py-3 transition-colors hover:bg-cream ' +
              (i > 0 ? 'border-t border-[var(--color-soft-border)]' : '')
            }
          >
            {o.label}
          </FilterCheckbox>
        ))}
      </div>
    </div>
  );
}

function statusFilterFooter(
  setShowActive: (v: boolean) => void,
  setShowInactive: (v: boolean) => void,
  onApply: () => void,
) {
  return (
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
      <Button variant="primary" className="w-full sm:w-auto" onClick={onApply}>
        Aplicar
      </Button>
    </>
  );
}

/** Bottom-sheet "Filtrar" (mobile) com a seção Status, como no Belasis. */
function StatusFilterDrawer({
  isOpen,
  onClose,
  showActive,
  showInactive,
  setShowActive,
  setShowInactive,
}: StatusFilterProps & { isOpen: boolean; onClose: () => void }) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Filtrar"
      footer={statusFilterFooter(setShowActive, setShowInactive, onClose)}
      placement="bottom"
    >
      <StatusFilterBody
        showActive={showActive}
        showInactive={showInactive}
        setShowActive={setShowActive}
        setShowInactive={setShowInactive}
      />
    </Drawer>
  );
}

/** Rótulo de campo do formulário dos drawers. */
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
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {required && <span className="mr-0.5 text-danger">*</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

/** Switch inline estilo Belasis: controle à esquerda, rótulo à direita, sem caixa. */
function InlineSwitch({
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
      className="flex items-center gap-2 text-sm text-foreground"
    >
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <span>{label}</span>
    </Switch>
  );
}

/** Switch de linha (label à esquerda, controle à direita) dos drawers. */
function RowSwitch({
  label,
  help,
  isSelected,
  onChange,
}: {
  label: string;
  help?: string;
  isSelected: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Switch
      isSelected={isSelected}
      onChange={onChange}
      className="flex h-11 items-center justify-between gap-3 rounded-lg border border-[var(--color-soft-border)] bg-white px-3"
    >
      <span className="inline-flex items-center text-sm text-foreground">
        {label}
        {help ? <HelpTooltip>{help}</HelpTooltip> : null}
      </span>
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
  // Acesso (Belasis id="admin_only"): false = qualquer usuário, true = só admins.
  const [adminOnly, setAdminOnly] = useState(false);
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
        setAdminOnly(editing.adminOnly);
      } else {
        setName('');
        setType('cash');
        setInitialBalance('');
        setActive(true);
        setAdminOnly(false);
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
      adminOnly,
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
          {/* Nome (2/3) + Saldo (1/3), como no Belasis (col-16 / col-8) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Nome" required>
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

          {/* Acesso — select do Belasis (id="admin_only"): qualquer usuário vs.
              somente administradores. Wired a FinancialAccount.adminOnly. */}
          <Field label="Acesso">
            <Select
              aria-label="Acesso"
              selectedKey={adminOnly ? 'admins' : 'all'}
              onSelectionChange={(k) => setAdminOnly(String(k) === 'admins')}
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="all" textValue="Qualquer usuário pode acessar">
                    Qualquer usuário pode acessar
                  </ListBox.Item>
                  <ListBox.Item id="admins" textValue="Somente administradores">
                    Somente administradores
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </Field>

          {/* Tipo — não existe no drawer de referência (usa SalonPay), mas o
              backend do SalonPass separa Caixa/Banco: mantido p/ data-wiring. */}
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

          {/* Somente campos persistidos pela API são exibidos aqui. */}
          <div className="flex flex-col gap-3">
            <InlineSwitch label="Ativa" isSelected={active} onChange={setActive} />
          </div>

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
  const [feeFixed, setFeeFixed] = useState('');
  const [settlementDays, setSettlementDays] = useState('');
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const [goesToCash, setGoesToCash] = useState(false);
  const [kind, setKind] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [active, setActive] = useState(true);
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
        setFeeFixed(String(editing.feeFixed ?? '0'));
        setSettlementDays(String(editing.settlementDays));
        setDefaultAccountId(editing.defaultAccountId ?? '');
        setGoesToCash(editing.goesToCash);
        setKind(editing.kind ?? '');
        setFavorite(editing.favorite ?? false);
        setActive(editing.active ?? true);
      } else {
        setName('');
        setFeePercent('');
        setFeeFixed('');
        setSettlementDays('');
        setDefaultAccountId('');
        setGoesToCash(false);
        setKind('');
        setFavorite(false);
        setActive(true);
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
      feeFixed: feeFixed ? Number(feeFixed.replace(',', '.')) : undefined,
      settlementDays: settlementDays ? Number(settlementDays) : undefined,
      defaultAccountId: defaultAccountId || undefined,
      goesToCash,
      kind: kind || undefined,
      favorite,
      active,
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
            <Field label="Taxa fixa (R$)">
              <TextField value={feeFixed} onChange={setFeeFixed} aria-label="Taxa fixa">
                <Input placeholder="R$ 0,00" inputMode="decimal" />
              </TextField>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prazo de recebimento (dias)">
              <TextField
                value={settlementDays}
                onChange={setSettlementDays}
                aria-label="Prazo de recebimento"
              >
                <Input placeholder="0" inputMode="numeric" />
              </TextField>
            </Field>
            <Field label="Tipo">
              <Select
                aria-label="Tipo"
                selectedKey={kind || null}
                onSelectionChange={(k) => setKind(k ? String(k) : '')}
              >
                <Select.Trigger>
                  <Select.Value>
                    {({ isPlaceholder, selectedText }) =>
                      isPlaceholder ? 'Selecione' : selectedText
                    }
                  </Select.Value>
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {METHOD_KIND_OPTIONS.map((o) => (
                      <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                        {o.label}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
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
            help="Se marcada, a forma dá baixa no caixa sem intervenção manual"
            isSelected={goesToCash}
            onChange={setGoesToCash}
          />
          <RowSwitch
            label="Favorito"
            help="Formas favoritas aparecem primeiro na hora de receber"
            isSelected={favorite}
            onChange={setFavorite}
          />
          <RowSwitch
            label="Ativa"
            help="Formas inativas não aparecem em novos recebimentos"
            isSelected={active}
            onChange={setActive}
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
            help="Se lançamentos desta categoria entram no cálculo de comissão"
            isSelected={countsAsCommission}
            onChange={setCountsAsCommission}
          />
          <RowSwitch
            label="Ativa"
            help="Categorias inativas não aparecem em novos lançamentos"
            isSelected={active}
            onChange={setActive}
          />

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
