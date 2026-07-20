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
export type CreateItem = { to: string; label: string; icon: IconType };
export type CreateGroup = { label: string; items: CreateItem[] };

export const CREATE_GROUPS: CreateGroup[] = [
  {
    label: 'Principal',
    items: [
      { to: '/agenda?new=1', label: 'Agendamento', icon: IconCalendar },
      { to: '/comandas?new=1', label: 'Comanda', icon: IconReceipt },
      { to: '/pacotes?new=1', label: 'Pacote', icon: IconLayers },
      { to: '/controle/pacotes-predefinidos?new=1', label: 'Pacote Predefinido', icon: IconLayers },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { to: '/clientes?new=1', label: 'Cliente', icon: IconUsers },
      { to: '/servicos?new=1', label: 'Serviço', icon: IconScissors },
      { to: '/produtos?new=1', label: 'Produto', icon: IconBox },
      { to: '/categorias?new=1', label: 'Categoria', icon: IconFolder },
      { to: '/profissionais?new=1', label: 'Profissional', icon: IconUserPlus },
      { to: '/fornecedores?new=1', label: 'Fornecedor', icon: IconTruck },
      { to: '/controle/compras?new=1', label: 'Compra', icon: IconBox },
      { to: '/marcas?new=1', label: 'Marca', icon: IconTag },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { to: '/financeiro/transacoes?new=recebimento', label: 'Recebimento', icon: IconArrowDown },
      { to: '/financeiro/transacoes?new=despesa', label: 'Despesa', icon: IconArrowUp },
      { to: '/financeiro/transacoes?new=vale', label: 'Vale', icon: IconWallet },
      { to: '/financeiro/transacoes?new=transferencia', label: 'Transferência', icon: IconRepeat },
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
