import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type DependencyList,
  type ReactNode,
} from 'react';
import {
  IconArrowDown,
  IconArrowUp,
  IconBox,
  IconCalendar,
  IconFolder,
  IconLayers,
  IconReceipt,
  IconRepeat,
  IconScissors,
  IconTag,
  IconTruck,
  IconUserPlus,
  IconUsers,
  IconWallet,
} from '../components/icons';

type IconType = ComponentType<{ size?: number }>;

// ─── Shared "Novo" (create) menu, grouped like belasis.app ──────────────────
// Rendered both in the Sidebar dropdown and in the mobile BottomNav sheet.
// Order and grouping match the Belasis "Novo +" bottom-sheet 1:1.

// Which entity a "Novo" tile creates. Consumed by the global CreateDrawerHost
// (CreateDrawer.tsx) which opens the matching drawer in-place — no navigation.
// Declared HERE (the leaf module) so CreateDrawer.tsx can `import type` it
// without a circular dependency (PageActions never imports CreateDrawer).
export type CreateKind =
  | 'cliente'
  | 'profissional'
  | 'servico'
  | 'produto'
  | 'categoria'
  | 'fornecedor'
  | 'marca'
  | 'agendamento'
  | 'comanda'
  | 'pacote'
  | 'assinatura'
  | 'despesa'
  | 'receita'
  | 'transferencia'
  | 'vale';

export type CreateItem = {
  to: string;
  label: string;
  icon: IconType;
  /** Entity opened in-place by the global create host. Omitted for disabled tiles. */
  kind?: CreateKind;
  /** If true, tile renders as visual placeholder ("Em breve") and does not navigate. */
  disabled?: boolean;
  /** Optional custom tooltip; defaults to "Em breve" when disabled. */
  disabledReason?: string;
};
export type CreateGroup = { label: string; items: CreateItem[] };

export const CREATE_GROUPS: CreateGroup[] = [
  {
    label: 'Principal',
    items: [
      { to: '/agenda?new=1', label: 'Agendamento', icon: IconCalendar, kind: 'agendamento' },
      { to: '/comandas?new=1', label: 'Comanda', icon: IconReceipt, kind: 'comanda' },
      // Faltavam no atalho de criar, embora existam no menu lateral e tenham
      // drawer pronto. O dono cobrou. Ver estudo 63.
      { to: '/pacotes?new=1', label: 'Pacote', icon: IconLayers, kind: 'pacote' },
      {
        to: '/assinaturas?new=1',
        label: 'Venda por assinatura',
        icon: IconRepeat,
        kind: 'assinatura',
      },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { to: '/clientes?new=1', label: 'Cliente', icon: IconUsers, kind: 'cliente' },
      { to: '/profissionais?new=1', label: 'Profissional', icon: IconUserPlus, kind: 'profissional' },
      { to: '/servicos?new=1', label: 'Serviço', icon: IconScissors, kind: 'servico' },
      { to: '/produtos?new=1', label: 'Produto', icon: IconBox, kind: 'produto' },
      { to: '/categorias?new=1', label: 'Categoria', icon: IconFolder, kind: 'categoria' },
      { to: '/fornecedores?new=1', label: 'Fornecedor', icon: IconTruck, kind: 'fornecedor' },
      { to: '/marcas?new=1', label: 'Marca', icon: IconTag, kind: 'marca' },
      { to: '#', label: 'Etiqueta', icon: IconLayers, disabled: true },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { to: '/financeiro/transacoes?new=despesa', label: 'Despesa', icon: IconArrowUp, kind: 'despesa' },
      { to: '/financeiro/transacoes?new=recebimento', label: 'Receita', icon: IconArrowDown, kind: 'receita' },
      { to: '/financeiro/transacoes?new=transferencia', label: 'Transferência', icon: IconRepeat, kind: 'transferencia' },
      { to: '/financeiro/transacoes?new=vale', label: 'Vale', icon: IconWallet, kind: 'vale' },
    ],
  },
];

// ─── Contextual page actions (dynamic BottomNav) ────────────────────────────
// A page registers the actions relevant to it (e.g. the Agenda registers
// Filtros / Ações / Criar) and the BottomNav renders them in place of the
// default tabs while that page is mounted.
export type PageAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
};

type PageActionsContextValue = {
  actions: PageAction[];
  setActions: (actions: PageAction[]) => void;
};

const PageActionsContext = createContext<PageActionsContextValue | null>(null);

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<PageAction[]>([]);
  // `setActions` from useState is stable, so the value only changes with `actions`.
  const value = useMemo<PageActionsContextValue>(() => ({ actions, setActions }), [actions]);
  return <PageActionsContext.Provider value={value}>{children}</PageActionsContext.Provider>;
}

// ─── Shared Create sheet (BottomNav mobile bottom sheet) ────────────────────
// The BottomNav owns the bottom-sheet UI; the Sidebar's mobile "Novo +" button
// reuses the same sheet through this context so both entry points open the
// exact same "Criar novo" UX from anywhere in the app.
type CreateSheetContextValue = {
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
};

const CreateSheetContext = createContext<CreateSheetContextValue | null>(null);

export function CreateSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo<CreateSheetContextValue>(
    () => ({ open, openSheet: () => setOpen(true), closeSheet: () => setOpen(false) }),
    [open],
  );
  return <CreateSheetContext.Provider value={value}>{children}</CreateSheetContext.Provider>;
}

export function useCreateSheet(): CreateSheetContextValue {
  // Fall back to a no-op so components that render outside DashboardLayout
  // (e.g. isolated tests) don't crash — the sheet just won't open.
  return (
    useContext(CreateSheetContext) ?? {
      open: false,
      openSheet: () => {},
      closeSheet: () => {},
    }
  );
}

/** Consumed by the BottomNav to know what to render. */
export function usePageActions(): PageAction[] {
  return useContext(PageActionsContext)?.actions ?? [];
}

/**
 * Register this page's contextual actions. Pass a `deps` array just like
 * `useEffect`: the actions are re-registered whenever it changes, and cleared
 * on unmount so the next page starts from the default BottomNav.
 */
export function useSetPageActions(actions: PageAction[], deps: DependencyList) {
  const setActions = useContext(PageActionsContext)?.setActions;
  useEffect(() => {
    if (!setActions) return;
    setActions(actions);
    return () => setActions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
