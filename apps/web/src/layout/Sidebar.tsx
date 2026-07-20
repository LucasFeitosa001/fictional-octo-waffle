import { useEffect, useRef, useState, type ComponentType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Button, ScrollShadow, Tooltip } from '@heroui/react';
import {
  IconBox,
  IconCalendar,
  IconCash,
  IconChart,
  IconChevron,
  IconClock,
  IconCopy,
  IconCreditCard,
  IconDollar,
  IconFolder,
  IconGift,
  IconHelpCircle,
  IconHome,
  IconInfo,
  IconLayers,
  IconLink,
  IconMegaphone,
  IconMessage,
  IconPanelLeft,
  IconPercent,
  IconPhone,
  IconPlus,
  IconReceipt,
  IconRepeat,
  IconScissors,
  IconSend,
  IconSettings,
  IconShare,
  IconSparkles,
  IconStar,
  IconTag,
  IconTarget,
  IconTruck,
  IconUserPlus,
  IconUsers,
  IconWhatsApp,
} from '../components/icons';
import { useSession } from '../lib/auth';
import { NotificationBell } from '../components/NotificationBell';
import { CREATE_GROUPS, useCreateSheet } from './PageActions';

type IconType = ComponentType<{ size?: number }>;

type NavItem = {
  to: string;
  label: string;
  icon: IconType;
  end?: boolean;
  badge?: 'Beta' | 'novo';
};

type NavGroup = {
  kind: 'group';
  key: string;
  title: string;
  icon: IconType;
  items: NavItem[];
};

type NavDirect = NavItem & {
  kind: 'link';
  key: string;
};

type NavEntry = NavGroup | NavDirect;

// Main navigation — the scrollable body of the sidebar. Utility entries
// (Configurações, Ajuda, Indique e ganhe) live in FOOTER_NAVIGATION instead so
// they always sit pinned at the bottom, matching Belasis's mobile menu.
const NAVIGATION: NavEntry[] = [
  {
    kind: 'link',
    key: 'ia',
    to: '/ia-atendimento',
    label: 'IA',
    icon: IconSparkles,
    badge: 'Beta',
  },
  {
    kind: 'group',
    key: 'principal',
    title: 'Principal',
    icon: IconHome,
    items: [
      { to: '/', label: 'Painel', icon: IconHome, end: true },
      { to: '/agenda', label: 'Agenda', icon: IconCalendar },
      { to: '/comandas', label: 'Comandas', icon: IconReceipt },
      { to: '/pacotes', label: 'Pacotes', icon: IconLayers },
      { to: '/assinaturas', label: 'Vendas por Assinatura', icon: IconRepeat },
    ],
  },
  {
    kind: 'group',
    key: 'financeiro',
    title: 'Financeiro',
    icon: IconDollar,
    items: [
      { to: '/financeiro', label: 'Painel', icon: IconChart, end: true },
      { to: '/financeiro/transacoes', label: 'Transações', icon: IconDollar },
      { to: '/financeiro/contas', label: 'Cadastros', icon: IconCreditCard },
      { to: '/financeiro/caixas', label: 'Caixas abertos', icon: IconCash, end: true },
      { to: '/financeiro/caixas/historico', label: 'Histórico de caixa', icon: IconClock },
      { to: '/caixa', label: 'Belasis Pay', icon: IconCreditCard, badge: 'novo' },
      { to: '/financeiro/notas-fiscais', label: 'Notas Fiscais', icon: IconReceipt },
      { to: '/financeiro/configuracoes', label: 'Configurações', icon: IconSettings },
    ],
  },
  {
    kind: 'group',
    key: 'comissoes',
    title: 'Comissões',
    icon: IconPercent,
    items: [
      { to: '/comissoes', label: 'Detalhadas', icon: IconPercent, end: true },
      { to: '/comissoes/pagas', label: 'Pagas', icon: IconCash },
      { to: '/comissoes/config', label: 'Configurações', icon: IconSettings },
    ],
  },
  {
    kind: 'group',
    key: 'cadastros',
    title: 'Cadastros',
    icon: IconUsers,
    items: [
      { to: '/clientes', label: 'Clientes', icon: IconUsers },
      { to: '/cadastros/anamneses', label: 'Anamneses', icon: IconMessage },
      { to: '/cadastros/convidar', label: 'Convidar profissionais', icon: IconUserPlus },
      { to: '/profissionais', label: 'Profissionais', icon: IconScissors },
      { to: '/fornecedores', label: 'Fornecedores', icon: IconTruck },
    ],
  },
  {
    kind: 'group',
    key: 'controle',
    title: 'Controle',
    icon: IconLayers,
    items: [
      { to: '/servicos', label: 'Serviços', icon: IconScissors },
      { to: '/produtos', label: 'Produtos', icon: IconBox },
      { to: '/controle/pacotes-predefinidos', label: 'Pacotes Predefinidos', icon: IconLayers },
      { to: '/categorias', label: 'Categorias', icon: IconFolder },
      { to: '/marcas', label: 'Marcas', icon: IconTag },
      { to: '/controle/compras', label: 'Compras', icon: IconBox },
      { to: '/controle/gerador-documento', label: 'Gerador de Documento', icon: IconCopy },
    ],
  },
  {
    kind: 'group',
    key: 'relatorios',
    title: 'Relatórios',
    icon: IconChart,
    items: [
      { to: '/relatorios', label: 'Painel', icon: IconHome, end: true },
      { to: '/metas', label: 'Metas', icon: IconTarget },
    ],
  },
  {
    kind: 'link',
    key: 'whatsapp',
    to: '/whatsapp',
    label: 'WhatsApp API Oficial',
    icon: IconWhatsApp,
    badge: 'novo',
  },
  {
    kind: 'group',
    key: 'marketing',
    title: 'Marketing',
    icon: IconMegaphone,
    items: [
      { to: '/marketing/link', label: 'Link de Agendamento', icon: IconLink },
      { to: '/marketing/agendamento-online', label: 'Agendamento Online', icon: IconCalendar },
      { to: '/marketing/campanhas', label: 'Automação de Marketing', icon: IconSend },
      { to: '/marketing/promocoes', label: 'Promoções', icon: IconMegaphone },
      { to: '/marketing/avaliacoes', label: 'Avaliações', icon: IconStar },
      { to: '/marketing/cashback', label: 'Cashback', icon: IconGift },
    ],
  },
];

// Pinned footer — Configurações / Ajuda / Indique e ganhe.
const FOOTER_NAVIGATION: NavEntry[] = [
  {
    kind: 'group',
    key: 'ajuda',
    title: 'Ajuda',
    icon: IconInfo,
    items: [
      { to: '/ajuda/suporte', label: 'Falar com o suporte', icon: IconPhone },
      { to: '/ajuda/base-conhecimento', label: 'Base de conhecimento', icon: IconInfo },
      { to: '/ajuda/feedback', label: 'Feedback', icon: IconMessage },
      { to: '/ajuda/novidades', label: 'Novidades do sistema', icon: IconSparkles },
    ],
  },
  {
    kind: 'link',
    key: 'configuracoes',
    to: '/configuracoes',
    label: 'Configurações',
    icon: IconSettings,
  },
  {
    kind: 'link',
    key: 'indique',
    to: '/indique-e-ganhe',
    label: 'Indique e ganhe',
    icon: IconShare,
  },
];

const ALL_ENTRIES: NavEntry[] = [...NAVIGATION, ...FOOTER_NAVIGATION];

const COLLAPSE_KEY = 'sp:sidebar:collapsed';
// v2 resets the previous default-open preference once. From this version on,
// every group starts collapsed and subsequent user choices are persisted.
const GROUP_COLLAPSE_KEY = 'sp:sidebar:groups:v2';
const DEFAULT_COLLAPSED_GROUPS = new Set(
  ALL_ENTRIES.filter((entry): entry is NavGroup => entry.kind === 'group').map((entry) => entry.key),
);

function loadCollapsedGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(GROUP_COLLAPSE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set(DEFAULT_COLLAPSED_GROUPS);
  } catch {
    return new Set(DEFAULT_COLLAPSED_GROUPS);
  }
}

function saveCollapsedGroups(groups: Set<string>) {
  try {
    localStorage.setItem(GROUP_COLLAPSE_KEY, JSON.stringify([...groups]));
  } catch {
    /* ignore */
  }
}

function pathIsActive(to: string, pathname: string) {
  const cleanPath = to.split(/[?#]/)[0];
  if (cleanPath === '/') return pathname === '/';
  return pathname === cleanPath || pathname.startsWith(`${cleanPath}/`);
}

// Belasis keeps the submenu that contains the current route open (its
// `ant-menu-submenu-selected ant-menu-submenu-open` state). Mirror that so the
// active page is always visible when the menu (mobile hamburger) opens.
function findActiveGroupKey(pathname: string): string | null {
  for (const entry of ALL_ENTRIES) {
    if (entry.kind === 'group' && entry.items.some((item) => pathIsActive(item.to, pathname))) {
      return entry.key;
    }
  }
  return null;
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'group flex min-h-10 items-center rounded-lg text-sm font-normal transition-colors',
    isActive ? 'db-nav-active' : 'text-white/70 hover:bg-white/[0.08] hover:text-white',
  ].join(' ');
}

function subNavLinkClass(state: { isActive: boolean }) {
  return `${navLinkClass(state)} pl-9`;
}

function MenuBadge({ children }: { children: 'Beta' | 'novo' }) {
  return (
    <span className="ml-2 shrink-0 rounded-md bg-gold px-1.5 py-0.5 text-[9px] font-bold leading-none text-ink">
      {children}
    </span>
  );
}

export function Sidebar({
  onNavigate,
  mobile = false,
}: {
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();
  const { openSheet: openCreateSheet } = useCreateSheet();

  const [collapsed, setCollapsed] = useState(() => {
    if (mobile) return false;
    return typeof localStorage !== 'undefined' && localStorage.getItem(COLLAPSE_KEY) === '1';
  });
  const isCollapsed = !mobile && collapsed;

  const activeGroupKey = findActiveGroupKey(location.pathname);
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    const initial = loadCollapsedGroups();
    if (activeGroupKey) initial.delete(activeGroupKey);
    return initial;
  });
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  const fullName = session?.user?.name?.trim() || 'Usuário';
  const firstName = fullName.split(/\s+/)[0];
  const avatarInitial = firstName.charAt(0).toUpperCase() || 'U';

  function toggleGroup(key: string) {
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveCollapsedGroups(next);
      return next;
    });
  }

  function toggleCollapse() {
    setCreateOpen(false);
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Keep the active route's group expanded as navigation changes (no persist —
  // this only reflects the current selection, never overwrites saved prefs).
  useEffect(() => {
    if (!activeGroupKey) return;
    setCollapsedGroups((previous) => {
      if (!previous.has(activeGroupKey)) return previous;
      const next = new Set(previous);
      next.delete(activeGroupKey);
      return next;
    });
  }, [activeGroupKey]);

  useEffect(() => {
    if (!createOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(event.target as Node)) {
        setCreateOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCreateOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [createOpen]);

  function quickCreate(to: string) {
    setCreateOpen(false);
    onNavigate?.();
    navigate(to);
  }

  // Mobile mirrors Belasis's hamburger: "Novo +" hands off to the BottomNav's
  // bottom-sheet (shared via CreateSheetProvider), so both entry points open
  // the same "Criar novo" sheet. Desktop keeps the inline dropdown flyout.
  function handleCreateClick() {
    if (mobile) {
      onNavigate?.();
      openCreateSheet();
      return;
    }
    setCreateOpen((previous) => !previous);
  }

  function renderCollapsedEntry(entry: NavEntry) {
    const EntryIcon = entry.icon;
    const active = entry.kind === 'link'
      ? pathIsActive(entry.to, location.pathname)
      : entry.items.some((item) => pathIsActive(item.to, location.pathname));
    const label = entry.kind === 'link' ? entry.label : entry.title;
    const className = [
      'grid h-11 w-full place-items-center rounded-lg transition-colors',
      active ? 'db-nav-active' : 'text-white/70 hover:bg-white/[0.08] hover:text-white',
    ].join(' ');

    const control = entry.kind === 'link' ? (
      <NavLink to={entry.to} onClick={onNavigate} className={className} aria-label={label}>
        <EntryIcon size={19} />
      </NavLink>
    ) : (
      <button type="button" className={className} aria-label={label}>
        <EntryIcon size={19} />
      </button>
    );

    // Colapsada: flyout à DIREITA na COR DA SIDEBAR. Link → só o label; grupo →
    // o submenu inteiro (subitens clicáveis), como no Belasis.
    return (
      <Tooltip key={entry.key} delay={0}>
        <Tooltip.Trigger className="contents">{control}</Tooltip.Trigger>
        <Tooltip.Content placement="right" className="db-sidebar rounded-xl border border-white/10 p-1.5 text-white shadow-[var(--shadow-pop)]">
          {entry.kind === 'link' ? (
            <span className="block px-2 py-0.5 text-xs font-medium">{label}</span>
          ) : (
            <div className="min-w-[196px]">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">{entry.title}</p>
              {entry.items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive ? 'db-nav-active' : 'text-white/80 hover:bg-white/[0.1] hover:text-white',
                      ].join(' ')
                    }
                  >
                    {ItemIcon ? <ItemIcon size={16} /> : null}
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          )}
        </Tooltip.Content>
      </Tooltip>
    );
  }

  function renderExpandedEntry(entry: NavEntry) {
    const EntryIcon = entry.icon;
    if (entry.kind === 'link') {
      return (
        <NavLink key={entry.key} to={entry.to} onClick={onNavigate} className={navLinkClass}>
          <span className="grid h-9 w-9 shrink-0 place-items-center"><EntryIcon size={19} /></span>
          <span className="min-w-0 flex-1 truncate pr-1">{entry.label}</span>
          {entry.badge && <MenuBadge>{entry.badge}</MenuBadge>}
        </NavLink>
      );
    }

    const groupOpen = !collapsedGroups.has(entry.key);
    const groupActive = entry.items.some((item) => pathIsActive(item.to, location.pathname));
    return (
      <div key={entry.key}>
        <button
          type="button"
          onClick={() => toggleGroup(entry.key)}
          aria-expanded={groupOpen}
          className={[
            'flex min-h-10 w-full items-center justify-between rounded-lg px-0 text-sm font-normal transition-colors',
            groupActive ? 'bg-white/[0.08] text-white' : 'text-white/75 hover:bg-white/[0.08] hover:text-white',
          ].join(' ')}
        >
          <span className="flex min-w-0 items-center">
            <span className="grid h-9 w-9 shrink-0 place-items-center"><EntryIcon size={19} /></span>
            <span className="truncate pr-2">{entry.title}</span>
          </span>
          <IconChevron size={14} className={`mr-3 transition-transform duration-200 ${groupOpen ? 'rotate-180' : ''}`} />
        </button>

        <div
          className={[
            'overflow-hidden transition-all duration-200',
            groupOpen ? 'max-h-[600px] py-1 opacity-100' : 'max-h-0 py-0 opacity-0',
          ].join(' ')}
        >
          <div className="flex flex-col gap-1">
            {entry.items.map(({ to, label, icon: ItemIcon, end, badge }) => (
              <NavLink key={to} to={to} end={end} onClick={onNavigate} className={subNavLinkClass}>
                <span className="grid h-9 w-8 shrink-0 place-items-center"><ItemIcon size={17} /></span>
                <span className="min-w-0 flex-1 truncate pr-1">{label}</span>
                {badge && <MenuBadge>{badge}</MenuBadge>}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside
      className={[
        'db-sidebar flex h-full shrink-0 flex-col py-4 transition-[width] duration-300 ease-out',
        mobile ? 'db-sidebar-mobile' : '',
        isCollapsed ? 'w-[76px] px-1' : mobile ? 'w-[208px] px-1' : 'w-[224px] px-1',
      ].join(' ')}
    >
      <div className={isCollapsed
        ? 'flex flex-col items-center gap-3 border-b border-white/[0.1] pb-3'
        : 'flex items-center justify-between gap-2 border-b border-white/[0.1] px-1 pb-3'}>
        {isCollapsed ? (
          <span
            aria-label="Salonpass"
            className="grid h-9 w-9 place-items-center rounded-xl bg-gold font-brand text-lg font-bold text-ink"
          >
            S
          </span>
        ) : (
          <div className="flex flex-col gap-1">
            <img src="/brand/salonpass-wordmark-white.svg" alt="Salonpass" className="h-7 w-auto self-start" />
          </div>
        )}

        <div className={isCollapsed ? 'flex flex-col items-center gap-2 text-white' : 'flex items-center gap-1 text-white'}>
          <NotificationBell />
          {mobile && (
            <>
              <NavLink
                to="/ajuda/suporte"
                onClick={onNavigate}
                aria-label="Falar com o suporte"
                className="relative rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <IconMessage size={22} />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" aria-hidden />
              </NavLink>
              <NavLink
                to="/ajuda/base-conhecimento"
                onClick={onNavigate}
                aria-label="Ajuda"
                className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <IconHelpCircle size={22} />
              </NavLink>
            </>
          )}
          {!mobile && (
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
              className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <IconPanelLeft size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Profile card — a single NavLink straight to /perfil (Belasis mobile
          menu behaviour). No dropdown; Sair lives on the profile page. */}
      <NavLink
        to="/perfil"
        onClick={onNavigate}
        className={[
          'mt-3 flex w-full items-center rounded-xl text-left transition-colors hover:bg-white/[0.1]',
          isCollapsed
            ? 'h-11 justify-center'
            : mobile
              ? 'gap-3 px-1 py-2'
              : 'gap-3 bg-white/[0.06] px-3 py-2.5',
        ].join(' ')}
      >
        <span
          className={[
            'grid shrink-0 place-items-center overflow-hidden bg-gold font-bold text-ink',
            // Belasis renders a square (ant-avatar-square) 40px avatar in the
            // mobile menu; the collapsed/desktop rail keeps the round chip.
            mobile ? 'h-10 w-10 rounded-lg text-base' : 'h-9 w-9 rounded-full text-sm',
          ].join(' ')}
        >
          {session?.user?.image ? (
            <img src={session.user.image} alt="user-avatar" className="h-full w-full object-cover" />
          ) : (
            avatarInitial
          )}
        </span>
        {!isCollapsed && (
          <span className="min-w-0 flex-1 leading-tight">
            <span className={`block truncate text-white ${mobile ? 'text-base font-bold' : 'text-sm font-semibold'}`}>Olá, {firstName.toUpperCase()}</span>
            <span className="mt-0.5 flex items-center gap-1 text-xs text-white/55">
              Meu perfil
              <IconChevron size={11} className="-rotate-90" />
            </span>
          </span>
        )}
      </NavLink>

      <div ref={createRef} className="relative mt-3">
        {isCollapsed ? (
          <Tooltip delay={150}>
            <Tooltip.Trigger className="contents">
              <button
                type="button"
                onClick={handleCreateClick}
                aria-label="Novo"
                aria-expanded={createOpen}
                className="grid h-10 w-full place-items-center rounded-xl bg-white text-ink transition-colors hover:bg-white/90"
              >
                <IconPlus size={18} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content className="rounded-lg bg-ink-soft px-2.5 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-pop)]">
              Novo
            </Tooltip.Content>
          </Tooltip>
        ) : (
          <Button
            variant="secondary"
            className={[
              'h-10 w-full rounded-xl bg-white font-semibold text-ink shadow-none hover:bg-white/90',
              // Belasis mobile hamburger centers the "Novo +" pill content; the
              // desktop expanded rail keeps label-left / plus-right.
              mobile ? 'justify-center gap-2' : 'justify-between',
            ].join(' ')}
            onClick={handleCreateClick}
            aria-expanded={mobile ? undefined : createOpen}
            aria-haspopup={mobile ? undefined : 'menu'}
          >
            Novo
            <IconPlus size={16} />
          </Button>
        )}

        {/* Desktop-only inline dropdown. On mobile, the button hands off to the
            BottomNav bottom-sheet via context. */}
        {!mobile && createOpen && (
          <div
            role="menu"
            className={[
              'absolute top-full z-50 mt-2 max-h-[min(520px,65vh)] w-[264px] overflow-y-auto rounded-2xl border border-black/[0.06] bg-warm-white p-1.5 shadow-[var(--shadow-pop)]',
              isCollapsed ? 'left-0' : 'left-0 right-0 w-auto',
            ].join(' ')}
          >
            {CREATE_GROUPS.map((group) => (
              <div key={group.label} className="pb-1">
                <div className="px-2.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9AA0A6]">
                  {group.label}
                </div>
                {group.items.map(({ to, label, icon: Icon, disabled = false, disabledReason }) => (
                  <button
                    key={`${group.label}-${label}`}
                    type="button"
                    role="menuitem"
                    onClick={() => (disabled ? undefined : quickCreate(to))}
                    disabled={disabled}
                    title={disabled ? disabledReason ?? 'Em breve' : undefined}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-gold">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 truncate text-sm font-normal text-ink">{label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <ScrollShadow
        className="db-sidebar-scroll -mr-1 mt-3 flex-1 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 scrollbar-thumb-rounded-full scrollbar-hover:scrollbar-thumb-white/35 scrollbar-active:scrollbar-thumb-white/45"
      >
        <nav className="flex flex-col gap-1">
          {NAVIGATION.map((entry) => (isCollapsed ? renderCollapsedEntry(entry) : renderExpandedEntry(entry)))}
        </nav>
      </ScrollShadow>

      {/* Pinned footer — Configurações / Ajuda / Indique e ganhe. */}
      <div className="mt-3 border-t border-white/[0.08] pt-3">
        <nav className="flex flex-col gap-1">
          {FOOTER_NAVIGATION.map((entry) => (isCollapsed ? renderCollapsedEntry(entry) : renderExpandedEntry(entry)))}
        </nav>
        {!isCollapsed && <div className="px-2.5 pt-3 text-[10px] text-white/35">v5.7.12</div>}
      </div>
    </aside>
  );
}
