import { useEffect, useRef, useState, type ComponentType } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  IconHome,
  IconInfo,
  IconLayers,
  IconLink,
  IconLogout,
  IconMegaphone,
  IconMessage,
  IconPanelLeft,
  IconPercent,
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
} from '../components/icons';
import { signOut, useSession } from '../lib/auth';
import { useCompany } from '../lib/queries';
import { NotificationBell } from '../components/NotificationBell';

type IconType = ComponentType<{ size?: number }>;

type NavItem = { to: string; label: string; icon: IconType; end?: boolean };

type NavGroup = { key: string; title: string; icon: IconType; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    key: 'principal',
    title: 'Principal',
    icon: IconHome,
    items: [
      { to: '/', label: 'Painel', icon: IconHome, end: true },
      { to: '/agenda', label: 'Agenda', icon: IconCalendar },
      { to: '/agendamentos', label: 'Agendamentos', icon: IconReceipt },
      { to: '/comandas', label: 'Comandas', icon: IconReceipt },
      { to: '/pacotes', label: 'Pacotes', icon: IconLayers },
      { to: '/assinaturas', label: 'Assinaturas', icon: IconRepeat },
    ],
  },
  {
    key: 'ia',
    title: 'Inteligência',
    icon: IconSparkles,
    items: [
      { to: '/ia-atendimento', label: 'IA Atendimento', icon: IconSparkles },
    ],
  },
  {
    key: 'financeiro',
    title: 'Financeiro',
    icon: IconDollar,
    items: [
      { to: '/financeiro', label: 'Painel financeiro', icon: IconChart, end: true },
      { to: '/financeiro/transacoes', label: 'Transações', icon: IconDollar },
      { to: '/financeiro/contas', label: 'Contas e métodos', icon: IconCreditCard },
      { to: '/caixa', label: 'Caixa', icon: IconCash },
      { to: '/financeiro/caixas', label: 'Caixas abertos', icon: IconCash },
      { to: '/financeiro/caixas/historico', label: 'Histórico de caixa', icon: IconClock },
      { to: '/financeiro/notas-fiscais', label: 'Notas Fiscais', icon: IconReceipt },
      { to: '/financeiro/configuracoes', label: 'Configurações', icon: IconSettings },
    ],
  },
  {
    key: 'comissoes',
    title: 'Comissões',
    icon: IconPercent,
    items: [
      { to: '/comissoes', label: 'Resumo', icon: IconPercent, end: true },
      { to: '/comissoes/config', label: 'Configurações', icon: IconSettings },
    ],
  },
  {
    key: 'cadastros',
    title: 'Cadastros',
    icon: IconUsers,
    items: [
      { to: '/clientes', label: 'Clientes', icon: IconUsers },
      { to: '/profissionais', label: 'Profissionais', icon: IconScissors },
      { to: '/fornecedores', label: 'Fornecedores', icon: IconTruck },
      { to: '/cadastros/anamneses', label: 'Anamneses', icon: IconMessage },
      { to: '/cadastros/convidar', label: 'Convidar profissionais', icon: IconUserPlus },
    ],
  },
  {
    key: 'controle',
    title: 'Controle',
    icon: IconLayers,
    items: [
      { to: '/servicos', label: 'Serviços', icon: IconScissors },
      { to: '/produtos', label: 'Produtos', icon: IconBox },
      { to: '/categorias', label: 'Categorias', icon: IconFolder },
      { to: '/marcas', label: 'Marcas', icon: IconTag },
      { to: '/controle/pacotes-predefinidos', label: 'Pacotes Predefinidos', icon: IconLayers },
      { to: '/controle/compras', label: 'Compras', icon: IconBox },
      { to: '/controle/gerador-documento', label: 'Gerador de Documento', icon: IconCopy },
    ],
  },
  {
    key: 'relatorios',
    title: 'Relatórios',
    icon: IconChart,
    items: [
      { to: '/relatorios', label: 'Relatórios', icon: IconChart, end: true },
      { to: '/metas', label: 'Metas', icon: IconTarget },
    ],
  },
  {
    key: 'marketing',
    title: 'Marketing',
    icon: IconMegaphone,
    items: [
      { to: '/marketing/agendamento-online', label: 'Agendamento Online', icon: IconCalendar },
      { to: '/marketing/link', label: 'Link de Agendamento', icon: IconLink },
      { to: '/marketing/promocoes', label: 'Promoções', icon: IconMegaphone },
      { to: '/marketing/campanhas', label: 'Campanhas', icon: IconSend },
      { to: '/marketing/avaliacoes', label: 'Avaliações', icon: IconStar },
      { to: '/marketing/cashback', label: 'Cashback', icon: IconGift },
    ],
  },
  {
    key: 'outros',
    title: 'Outros',
    icon: IconSettings,
    items: [
      { to: '/configuracoes', label: 'Configurações', icon: IconSettings },
      { to: '/ajuda', label: 'Ajuda', icon: IconInfo },
      { to: '/indique', label: 'Indique e ganhe', icon: IconShare },
    ],
  },
];

type QuickCreate = { to: string; label: string; description: string; icon: IconType };

const QUICK_CREATE: QuickCreate[] = [
  { to: '/agenda?new=1', label: 'Agendamento', description: 'Marcar um horário', icon: IconCalendar },
  { to: '/comandas?new=1', label: 'Comanda', description: 'Abrir uma venda', icon: IconReceipt },
  { to: '/clientes?new=1', label: 'Cliente', description: 'Cadastrar pessoa', icon: IconUsers },
  { to: '/servicos?new=1', label: 'Serviço', description: 'Novo serviço', icon: IconScissors },
  { to: '/produtos?new=1', label: 'Produto', description: 'Item de estoque', icon: IconBox },
  { to: '/profissionais?new=1', label: 'Profissional', description: 'Adicionar à equipe', icon: IconScissors },
];

const COLLAPSE_KEY = 'sp:sidebar:collapsed';
const GROUP_COLLAPSE_KEY = 'sp:sidebar:groups';

function loadCollapsedGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(GROUP_COLLAPSE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveCollapsedGroups(groups: Set<string>) {
  try { localStorage.setItem(GROUP_COLLAPSE_KEY, JSON.stringify([...groups])); } catch {}
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'group flex items-center rounded-lg text-sm font-medium transition-all duration-200',
    isActive ? 'db-nav-active' : 'text-white/70 hover:bg-white/[0.08] hover:text-white',
  ].join(' ');
}

export function Sidebar({
  onNavigate,
  mobile = false,
}: {
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const { data: session } = useSession();

  const [collapsed, setCollapsed] = useState(() => {
    if (mobile) return false;
    return typeof localStorage !== 'undefined' && localStorage.getItem(COLLAPSE_KEY) === '1';
  });
  const isCollapsed = !mobile && collapsed;

  const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedGroups);
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      saveCollapsedGroups(next);
      return next;
    });
  }

  function toggleCollapse() {
    setCreateOpen(false);
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  useEffect(() => {
    if (!createOpen) return;
    const onDown = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCreateOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [createOpen]);

  function quickCreate(to: string) {
    setCreateOpen(false);
    onNavigate?.();
    navigate(to);
  }

  return (
    <aside
      className={[
        'db-sidebar flex h-full shrink-0 flex-col py-5 transition-[width] duration-300 ease-out',
        mobile ? 'db-sidebar-mobile' : '',
        isCollapsed ? 'w-[84px] px-3' : 'w-[296px] px-4',
      ].join(' ')}
    >
      {/* Brand + collapse toggle */}
      <div className={isCollapsed ? 'flex flex-col items-center gap-3' : 'flex items-center justify-between gap-2 px-1'}>
        {isCollapsed ? (
          <span
            aria-label="Salonpass"
            className="grid h-9 w-9 place-items-center rounded-xl bg-[#f2b33d] font-brand text-lg font-bold text-[#111111]"
          >
            S
          </span>
        ) : (
          <div className="flex flex-col gap-1">
            <img src="/brand/salonpass-wordmark-white.svg" alt="Salonpass" className="h-7 w-auto self-start" />
            <div className="pl-0.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/55">
              Gestão
            </div>
          </div>
        )}
        {mobile ? (
          <div className="text-white">
            <NotificationBell />
          </div>
        ) : (
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

      {/* Profile (mobile only) */}
      {mobile && (
        <button
          type="button"
          onClick={() => { onNavigate?.(); navigate('/perfil'); }}
          className="mt-4 flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.1]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f2b33d] text-sm font-bold text-[#111111]">
            {session?.user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-white">
              {session?.user?.name ?? 'Meu Perfil'}
            </div>
            <div className="truncate text-xs text-white/55">
              {session?.user?.email ?? 'Ver perfil'}
            </div>
          </div>
        </button>
      )}

      {/* Novo (quick create) */}
      <div ref={createRef} className="relative mt-5">
        {isCollapsed ? (
          <Tooltip delay={150}>
            <Tooltip.Trigger className="contents">
              <button
                type="button"
                onClick={() => setCreateOpen((v) => !v)}
                aria-label="Criar novo"
                aria-expanded={createOpen}
                className="grid h-11 w-full place-items-center rounded-xl bg-[#f2b33d] text-[#111111] shadow-[var(--shadow-gold)] transition-transform hover:scale-[1.03]"
              >
                <IconPlus size={20} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content className="rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-pop)]">
              Criar novo
            </Tooltip.Content>
          </Tooltip>
        ) : (
          <Button
            variant="secondary"
            className="w-full justify-between bg-[#f2b33d] font-semibold text-[#111111] shadow-[var(--shadow-gold)] hover:bg-[#e6a92f]"
            onClick={() => setCreateOpen((v) => !v)}
            aria-expanded={createOpen}
            aria-haspopup="menu"
          >
            Novo
            <IconPlus size={16} />
          </Button>
        )}

        {createOpen && (
          <div
            role="menu"
            className={[
              'absolute top-full z-30 mt-2 w-[264px] overflow-hidden rounded-2xl border border-black/[0.06] bg-[#fffdf8] p-1.5 shadow-[var(--shadow-pop)]',
              isCollapsed ? 'left-0' : 'left-0 right-0 w-auto',
            ].join(' ')}
          >
            {QUICK_CREATE.map(({ to, label, description, icon: Icon }) => (
              <button
                key={to}
                type="button"
                role="menuitem"
                onClick={() => quickCreate(to)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[#f7f3ea]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#111111] text-[#f2b33d]">
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#111111]">{label}</span>
                  <span className="block text-xs text-[#6f6a63]">{description}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <ScrollShadow className="-mr-1 mt-5 flex-1 pr-1" hideScrollBar>
        <nav className="flex flex-col gap-5">
          {GROUPS.map((group) => {
            const groupOpen = !collapsedGroups.has(group.key);
            const GroupIcon = group.icon;
            return (
            <div key={group.key}>
              {!isCollapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="flex min-h-10 w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-semibold text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center text-white/65">
                      <GroupIcon size={18} />
                    </span>
                    <span className="truncate">{group.title}</span>
                  </span>
                  <IconChevron
                    size={14}
                    className={'transition-transform duration-200 ' + (groupOpen ? '' : '-rotate-90')}
                  />
                </button>
              )}
              <div
                className={'flex flex-col gap-1 overflow-hidden transition-all duration-200 ' + (!isCollapsed && !groupOpen ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100')}
              >
                {group.items.map(({ to, label, icon: Icon, end }) => {
                  const link = (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={onNavigate}
                      className={navLinkClass}
                      title={isCollapsed ? label : undefined}
                    >
                      <span
                        className={[
                          'grid place-items-center',
                          isCollapsed ? 'h-11 w-full' : 'h-9 w-9 shrink-0',
                        ].join(' ')}
                      >
                        <Icon size={19} />
                      </span>
                      {!isCollapsed && <span className="truncate pr-2">{label}</span>}
                    </NavLink>
                  );
                  if (!isCollapsed) return link;
                  return (
                    <Tooltip key={to} delay={150}>
                      <Tooltip.Trigger className="contents">{link}</Tooltip.Trigger>
                      <Tooltip.Content className="rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-pop)]">
                        {label}
                      </Tooltip.Content>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
            );
          })}
        </nav>
      </ScrollShadow>

      {/* Footer */}
      <div className="mt-4 border-t border-white/[0.06] pt-3">
        {!isCollapsed && (
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white/[0.05] px-3 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f2b33d] text-[#111111]">
              <IconStar size={18} />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-white">
                {company?.name ?? 'Meu Salão'}
              </div>
              <div className="text-xs text-white/55">Plano Pro</div>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut()}
          aria-label="Sair"
          className={[
            'flex items-center rounded-xl text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white',
            isCollapsed ? 'h-11 w-full justify-center' : 'w-full gap-3 px-3 py-2.5',
          ].join(' ')}
        >
          <IconLogout size={19} />
          {!isCollapsed && 'Sair'}
        </button>
      </div>
    </aside>
  );
}
