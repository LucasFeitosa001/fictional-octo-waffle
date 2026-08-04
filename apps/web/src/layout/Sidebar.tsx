import { useEffect, useRef, useState, type ComponentType } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  IconLogout,
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
  IconUser,
  IconUsers,
  IconWhatsApp,
  IconLock,
} from '../components/icons';
import { useSession, signOut } from '../lib/auth';
import { useFeatures, type FeatureKey } from '../lib/queries/features';
import { useCan } from '../lib/queries/permissions';
import { CompanySwitcher } from '../components/CompanySwitcher';
import { urlDaAreaDeIa } from '../lib/aiHost';
import { useMinhasContas } from '../lib/queries/contas';
import { useBookingLink } from '../lib/queries/marketing';
import { useEmpresa } from '../lib/queries/empresa';
import { APP_VERSION, CLUB_ORIGIN } from '../lib/config';
import { toast, TOAST_TIMEOUT } from '../lib/toast';
import { useSidebarStyle } from '../theme/sidebarStyle';
import { NotificationBell } from '../components/NotificationBell';
import { IconTip } from '../components/IconTip';
import { ZoomControls } from '../components/ZoomControls';
import { InstallPwaButton } from '../components/InstallPwaButton';
import { MinhaContaDrawer } from '../components/MinhaContaDrawer';
import { CREATE_GROUPS, type CreateItem } from './PageActions';
import { useCreateDrawer } from './CreateDrawer';

type IconType = ComponentType<{ size?: number }>;

type NavItem = {
  to: string;
  label: string;
  icon: IconType;
  end?: boolean;
  badge?: 'Beta' | 'novo' | 'em breve';
  action?: 'copy-booking-link';
  /**
   * FASE 2: paid feature this item belongs to. When the company's plan does not
   * include it, the item shows a lock icon (still clickable — the destination
   * page renders its own upsell). In dev (premium plan) nothing is locked.
   */
  feature?: FeatureKey;
  /**
   * Item que só existe numa das plataformas. A tela de ENTRADA de um módulo
   * pode diferir: no celular a tabela item a item de Comissões → Detalhadas é
   * ruim de ler, e o resumo por profissional é o destino útil; no desktop vale
   * o contrário. As abas dentro da página continuam levando às duas.
   */
  only?: 'desktop' | 'mobile';
  /**
   * FASE RBAC: permissão (ou lista, OR) que o papel precisa ter para VER o item.
   * Sem `perm` → todo mundo vê. Com `perm` → some da navegação de quem não pode.
   * Diferente de `feature` (que só cadeia): sem permissão o item não aparece.
   */
  perm?: string | string[];
  /**
   * Item que sai do painel e abre em OUTRA janela (a área de IA vive em
   * `ai.salonpass.com.br`). O login é o mesmo cookie do domínio-base, então a
   * janela nova já abre logada. Ver estudo 62.
   */
  externo?: 'ia';
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
    // A área de IA agora é um produto separado (ai.salonpass.com.br) que abre em
    // outra janela. `to` fica como destino de fallback para quem não tem o
    // subdomínio disponível.
    to: '/ia-atendimento',
    externo: 'ia',
    label: 'IA',
    icon: IconSparkles,
    badge: 'Beta',
    perm: 'config:manage',
  },
  {
    // O embed da Voltr é "bare" de propósito: o iframe entrega só o miolo, sem
    // navegação por dentro. Quem oferece a troca Atendimento ↔ CRM somos nós —
    // sem estes dois itens a rota /voltr-chat existe e ninguém alcança.
    kind: 'group',
    key: 'voltr',
    title: 'CRM',
    icon: IconMessage,
    items: [
      {
        to: '/voltr-chat',
        label: 'Atendimento',
        icon: IconMessage,
        badge: 'novo',
        feature: 'whatsapp_api',
        perm: 'marketing:view',
      },
      {
        to: '/voltr-crm',
        label: 'Contatos',
        icon: IconUsers,
        feature: 'whatsapp_api',
        perm: 'marketing:view',
      },
      {
        to: '/voltr-boards',
        label: 'Kanban',
        icon: IconLayers,
        feature: 'whatsapp_api',
        perm: 'marketing:view',
      },
      {
        // A agenda de follow-up do CRM. Estava pronta do outro lado (rotas,
        // tela e tudo) e não tinha porta de entrada: quem move um negócio no
        // Kanban não tinha onde anotar "ligar quinta".
        to: '/voltr-tarefas',
        label: 'Tarefas',
        icon: IconClock,
        feature: 'whatsapp_api',
        perm: 'marketing:view',
      },
      {
        to: '/voltr-ia',
        label: 'Inteligência artificial',
        icon: IconSparkles,
        feature: 'whatsapp_api',
        perm: 'marketing:view',
      },
    ],
  },
  {
    kind: 'group',
    key: 'principal',
    title: 'Principal',
    icon: IconHome,
    items: [
      { to: '/painel', label: 'Painel', icon: IconHome, end: true },
      { to: '/agenda', label: 'Agenda', icon: IconCalendar, perm: 'agenda:view' },
      { to: '/comandas', label: 'Comandas', icon: IconReceipt, perm: 'comandas:view' },
      { to: '/pacotes', label: 'Pacotes', icon: IconLayers, feature: 'packages', perm: 'catalogo:view' },
      { to: '/assinaturas', label: 'Vendas por Assinatura', icon: IconRepeat, feature: 'memberships', perm: 'catalogo:view' },
    ],
  },
  {
    kind: 'group',
    key: 'financeiro',
    title: 'Financeiro',
    icon: IconDollar,
    items: [
      { to: '/financeiro', label: 'Painel', icon: IconChart, end: true, perm: 'financeiro:view' },
      { to: '/financeiro/transacoes', label: 'Transações', icon: IconDollar, perm: 'financeiro:view' },
      { to: '/financeiro/contas', label: 'Cadastros', icon: IconCreditCard, perm: 'financeiro:view' },
      // Caixa: quem só opera o próprio caixa também acessa (caixa:operate OU view_all).
      { to: '/financeiro/caixas', label: 'Caixas abertos', icon: IconCash, end: true, perm: ['caixa:operate', 'caixa:view_all'] },
      { to: '/financeiro/caixas/historico', label: 'Histórico de caixa', icon: IconClock, perm: ['caixa:operate', 'caixa:view_all'] },
      // Deixou de ser "em breve": o cadastro de recebimento existe e abre aqui.
      // A rota antiga (`belasis-pay`) segue viva redirecionando, para favorito
      // não virar 404.
      { to: '/financeiro/salonpay', label: 'SalonPay', icon: IconCreditCard, perm: 'financeiro:view' },
      { to: '/financeiro/notas-fiscais', label: 'Notas Fiscais', icon: IconReceipt, feature: 'nfe', perm: 'financeiro:view' },
      { to: '/financeiro/configuracoes', label: 'Configurações', icon: IconSettings, perm: 'financeiro:view' },
    ],
  },
  {
    kind: 'group',
    key: 'comissoes',
    title: 'Comissões',
    icon: IconPercent,
    items: [
      // Profissional vê as próprias (view_own); gestão vê todas (view_all).
      // Desktop entra pelo detalhamento; celular entra pelo resumo. Quem quiser
      // o outro alterna pelas abas do topo (quatro no desktop, três no celular).
      //
      // O rótulo do item do celular é "Resumo", não "Resumidas": é o mesmo nome
      // que a aba correspondente usa lá (COMMISSION_TABS_MOBILE, em
      // pages/comissoes/tabs.tsx). Menu e aba apontando pro mesmo destino com
      // nomes diferentes foi reclamação do dono. A ROTA segue /comissoes/resumidas
      // — só o texto muda, pra não quebrar favorito nem link antigo.
      { to: '/comissoes', label: 'Detalhadas', icon: IconPercent, end: true, only: 'desktop', feature: 'commissions', perm: ['comissoes:view_own', 'comissoes:view_all'] },
      { to: '/comissoes/resumidas', label: 'Resumo', icon: IconChart, only: 'mobile', feature: 'commissions', perm: ['comissoes:view_own', 'comissoes:view_all'] },
      { to: '/comissoes/pagas', label: 'Pagas', icon: IconCash, feature: 'commissions', perm: ['comissoes:view_own', 'comissoes:view_all'] },
      { to: '/comissoes/config', label: 'Configurações', icon: IconSettings, feature: 'commissions', perm: 'comissoes:config' },
    ],
  },
  {
    kind: 'group',
    key: 'cadastros',
    title: 'Cadastros',
    icon: IconUsers,
    items: [
      { to: '/clientes', label: 'Clientes', icon: IconUsers, perm: 'clientes:view' },
      { to: '/cadastros/anamneses', label: 'Anamneses', icon: IconMessage, perm: 'anamneses:manage' },
      // "Profissionais" é a página CONSOLIDADA de equipe: cadastro + acesso (gerar
      // login) + permissões granulares. Absorveu "Convidar profissionais" e
      // "Usuários" (rotas antigas redirecionam pra cá em App.tsx).
      { to: '/profissionais', label: 'Profissionais', icon: IconScissors, perm: 'equipe:view' },
      { to: '/fornecedores', label: 'Fornecedores', icon: IconTruck, perm: 'catalogo:view' },
    ],
  },
  {
    kind: 'group',
    key: 'controle',
    title: 'Controle',
    icon: IconLayers,
    items: [
      { to: '/servicos', label: 'Serviços', icon: IconScissors, perm: 'catalogo:view' },
      { to: '/produtos', label: 'Produtos', icon: IconBox, perm: 'catalogo:view' },
      { to: '/controle/pacotes-predefinidos', label: 'Pacotes Predefinidos', icon: IconLayers, feature: 'packages', perm: 'catalogo:view' },
      { to: '/categorias', label: 'Categorias', icon: IconFolder, perm: 'catalogo:view' },
      { to: '/marcas', label: 'Marcas', icon: IconTag, perm: 'catalogo:view' },
      { to: '/controle/compras', label: 'Compras', icon: IconBox, perm: 'estoque:manage' },
      { to: '/controle/gerador-documento', label: 'Gerador de Documento', icon: IconCopy, badge: 'em breve', perm: 'catalogo:view' },
    ],
  },
  {
    kind: 'group',
    key: 'relatorios',
    title: 'Relatórios',
    icon: IconChart,
    items: [
      // O hub de relatórios abre tanto os operacionais quanto os financeiros.
      { to: '/relatorios', label: 'Painel', icon: IconHome, end: true, feature: 'reports_advanced', perm: ['relatorios:operacional', 'relatorios:financeiro'] },
      { to: '/metas', label: 'Metas', icon: IconTarget, feature: 'goals', perm: 'relatorios:operacional' },
    ],
  },
  {
    kind: 'link',
    key: 'whatsapp',
    to: '/whatsapp',
    label: 'WhatsApp integrado',
    icon: IconWhatsApp,
    badge: 'novo',
    feature: 'whatsapp_api',
    perm: 'marketing:view',
  },
  {
    kind: 'group',
    key: 'marketing',
    title: 'Marketing',
    icon: IconMegaphone,
    items: [
      { to: '/marketing/link', label: 'Link de Agendamento', icon: IconLink, action: 'copy-booking-link', feature: 'online_booking', perm: 'marketing:view' },
      { to: '/marketing/agendamento-online', label: 'Agendamento Online', icon: IconCalendar, feature: 'online_booking', perm: 'marketing:view' },
      { to: '/marketing/campanhas', label: 'Automação de Marketing', icon: IconSend, feature: 'campaigns', perm: 'marketing:view' },
      { to: '/marketing/promocoes', label: 'Promoções', icon: IconMegaphone, feature: 'campaigns', perm: 'marketing:view' },
      { to: '/marketing/avaliacoes', label: 'Avaliações', icon: IconStar, perm: 'marketing:view' },
      { to: '/marketing/cashback', label: 'Cashback', icon: IconGift, feature: 'cashback', perm: 'marketing:view' },
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
    perm: 'config:view',
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

function MenuBadge({
  children,
}: {
  children: 'Beta' | 'novo' | 'em breve';
}) {
  return (
    <span className="shrink-0 rounded-md bg-[#FCE4EA] px-1.5 py-0.5 text-[9px] font-bold leading-none text-[#A84065] ring-1 ring-inset ring-white/30">
      {children}
    </span>
  );
}

/** Lock affixed to a paid menu item the current plan does not include. */
function LockBadge() {
  return (
    <span
      className="ml-2 shrink-0 text-white/45"
      aria-label="Recurso de um plano superior"
      title="Recurso de um plano superior — faça upgrade"
    >
      <IconLock size={13} />
    </span>
  );
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard indisponível');
}

export function Sidebar({
  onNavigate,
  mobile = false,
  mobileOpen = false,
}: {
  onNavigate?: () => void;
  mobile?: boolean;
  /** Sinaliza (edge false→true) que o drawer mobile abriu — reseta collapsedGroups
   *  sem remontar (remount quebra a animação de saída do drawer parent). */
  mobileOpen?: boolean;
}) {
  const location = useLocation();
  const sidebarStyle = useSidebarStyle();
  const { data: session } = useSession();
  const { openCreate } = useCreateDrawer();
  const bookingLink = useBookingLink();
  const { data: empresa } = useEmpresa();
  // Fátima não usa o produto CRM/Voltr. O gate é por empresa, não por usuário:
  // enquanto o cadastro ainda carrega mantemos o menu (fail-open), e depois
  // removemos o grupo inteiro, inclusive os atalhos internos.
  const crmOculto = Boolean(
    empresa?.name?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() ===
      'fatima cabelos',
  );
  // FASE 2: features ativas do plano. Fail-open: sem dados (loading/erro) nada é
  // travado — só mostramos cadeado quando SABEMOS que a feature não está no plano.
  const { data: featuresData } = useFeatures();
  function isLocked(feature?: FeatureKey): boolean {
    if (!feature) return false;
    if (!featuresData) return false; // fail-open
    return !featuresData.features.includes(feature);
  }

  // FASE RBAC: gating por PAPEL da navegação. Diferente de features (cadeado),
  // aqui o item some do menu de quem não tem a permissão. Enquanto as permissões
  // AINDA carregam mostramos tudo (gate de UI, não de segurança — o backend é
  // quem barra de fato); ao resolver, aplicamos o gate real (fail-closed).
  const { can, isLoading: permsLoading } = useCan();
  function canSee(perm?: string | string[]): boolean {
    if (!perm) return true; // item aberto a todos
    if (permsLoading) return true; // não piscar o menu no primeiro paint
    const perms = Array.isArray(perm) ? perm : [perm];
    return perms.some((p) => can(p));
  }

  /** Item marcado para a OUTRA plataforma não entra neste menu. */
  function daPlataforma(item: NavItem): boolean {
    if (!item.only) return true;
    return item.only === (mobile ? 'mobile' : 'desktop');
  }

  // Filtra grupos/links pelo papel e pela plataforma. Grupo cujos itens somem
  // por completo também some. Links diretos são avaliados pelo próprio `perm`.
  function filterEntries(entries: NavEntry[]): NavEntry[] {
    const out: NavEntry[] = [];
    for (const entry of entries) {
      if (entry.key === 'voltr' && crmOculto) continue;
      if (entry.kind === 'link') {
        if (canSee(entry.perm) && daPlataforma(entry)) out.push(entry);
        continue;
      }
      const items = entry.items.filter((item) => canSee(item.perm) && daPlataforma(item));
      if (items.length > 0) out.push({ ...entry, items });
    }
    return out;
  }

  const visibleNavigation = filterEntries(NAVIGATION);
  const visibleFooter = filterEntries(FOOTER_NAVIGATION);

  // Só mostra o seletor de empresa quando o usuário é membro de mais de uma.
  const { data: contas } = useMinhasContas();
  const hasMultipleCompanies = (contas?.length ?? 0) > 1;

  const [collapsed, setCollapsed] = useState(() => {
    if (mobile) return false;
    return typeof localStorage !== 'undefined' && localStorage.getItem(COLLAPSE_KEY) === '1';
  });
  // O colapso do sidebar é MANUAL (toggle), respeitando a preferência salva.
  // NÃO forçamos minimizar em telas estreitas — em tablet/iPad o usuário decide.
  const forcedCollapsed = false;
  const isCollapsed = !mobile && collapsed;

  const activeGroupKey = findActiveGroupKey(location.pathname);
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    // Todos os grupos começam colapsados, EXCETO o que contém a rota atual —
    // assim a sidebar mostra só o que está realmente ativo (não expande tudo).
    // Mobile não persiste em localStorage; desktop respeita a preferência salva.
    const initial = mobile
      ? new Set(DEFAULT_COLLAPSED_GROUPS)
      : loadCollapsedGroups();
    if (activeGroupKey) initial.delete(activeGroupKey);
    return initial;
  });
  // Mobile: cada vez que o drawer ABRE (mobileOpen false→true), reseta pra
  // todos colapsados menos o grupo ativo. Sem remontar — assim a animação de
  // saída do parent roda.
  useEffect(() => {
    if (mobile && mobileOpen) {
      const next = new Set(DEFAULT_COLLAPSED_GROUPS);
      if (activeGroupKey) next.delete(activeGroupKey);
      setCollapsedGroups(next);
    }
  }, [mobile, mobileOpen, activeGroupKey]);
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [minhaContaOpen, setMinhaContaOpen] = useState(false);
  // Fecha o dropdown do perfil ao clicar fora ou Esc.
  useEffect(() => {
    if (!profileOpen) return;
    function onDown(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setProfileOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

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

  async function copyBookingLink() {
    onNavigate?.();
    const slug = bookingLink.data?.slug?.trim();
    if (!slug) {
      toast.danger('Não foi possível carregar o link de agendamento.', {
        timeout: TOAST_TIMEOUT,
      });
      return;
    }

    try {
      const url = `${CLUB_ORIGIN}/${slug}`;
      await copyText(url);
      toast.success('Link de agendamento copiado', {
        description: url,
        timeout: 10_000,
        actionProps: {
          children: 'Abrir',
          onPress: () =>
            window.open(url, '_blank', 'noopener,noreferrer'),
        },
      });
    } catch {
      toast.danger('Não foi possível copiar o link de agendamento.', {
        timeout: TOAST_TIMEOUT,
      });
    }
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

  // Create-in-place: abre o drawer da entidade DIRETO (sem navegar), mantendo o
  // usuário na página atual. Fecha o dropdown e, no mobile, o drawer do menu.
  function quickCreate(item: CreateItem) {
    setCreateOpen(false);
    onNavigate?.();
    if (item.kind) openCreate(item.kind);
  }

  // "Novo +" abre o MESMO dropdown inline em mobile e desktop (3 seções:
  // Principal / Cadastros / Financeiro). Antes o mobile abria um bottom-sheet
  // (CreateSheetProvider) — o user pediu dropdown nos dois.
  function handleCreateClick() {
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

    const control = entry.kind === 'link' && entry.externo === 'ia' ? (
      <a
        href={urlDaAreaDeIa('/')}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={className}
        aria-label={`${label} (abre em outra janela)`}
      >
        <EntryIcon size={19} />
      </a>
    ) : entry.kind === 'link' ? (
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
        <Tooltip.Trigger className="block w-full">{control}</Tooltip.Trigger>
        <Tooltip.Content placement="right" className="db-sidebar rounded-xl border border-white/10 p-1.5 text-white shadow-[var(--shadow-pop)]">
          {entry.kind === 'link' ? (
            <span className="block px-2 py-0.5 text-xs font-medium">{label}</span>
          ) : (
            <div className="min-w-[196px]">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">{entry.title}</p>
              {entry.items.map((item) => {
                const ItemIcon = item.icon;
                const content = (
                  <>
                    {ItemIcon ? <ItemIcon size={16} /> : null}
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                      <span className="truncate">{item.label}</span>
                      {!isLocked(item.feature) && item.badge && <MenuBadge>{item.badge}</MenuBadge>}
                    </span>
                    {isLocked(item.feature) && <LockBadge />}
                  </>
                );
                if (item.action === 'copy-booking-link') {
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => void copyBookingLink()}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/[0.1] hover:text-white"
                    >
                      {content}
                    </button>
                  );
                }
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
                    {content}
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
      const conteudo = (
        <>
          <span className="grid h-9 w-9 shrink-0 place-items-center"><EntryIcon size={19} /></span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 pr-1">
            <span className="truncate">{entry.label}</span>
            {!isLocked(entry.feature) && entry.badge && <MenuBadge>{entry.badge}</MenuBadge>}
          </span>
          {isLocked(entry.feature) && <LockBadge />}
        </>
      );
      if (entry.externo === 'ia') {
        return (
          <a
            key={entry.key}
            href={urlDaAreaDeIa('/')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            className={navLinkClass({ isActive: false })}
            title="Abre a área de IA em outra janela"
          >
            {conteudo}
          </a>
        );
      }
      return (
        <NavLink key={entry.key} to={entry.to} onClick={onNavigate} className={navLinkClass}>
          {conteudo}
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
            {entry.items.map((item) => {
              const ItemIcon = item.icon;
              const content = (
                <>
                  <span className="grid h-9 w-8 shrink-0 place-items-center"><ItemIcon size={17} /></span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 pr-1 text-left">
                    <span className="truncate">{item.label}</span>
                    {!isLocked(item.feature) && item.badge && <MenuBadge>{item.badge}</MenuBadge>}
                  </span>
                  {isLocked(item.feature) && <LockBadge />}
                </>
              );

              if (item.action === 'copy-booking-link') {
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => void copyBookingLink()}
                    className={subNavLinkClass({ isActive: false })}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={subNavLinkClass}>
                  {content}
                </NavLink>
              );
            })}
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
        !mobile && sidebarStyle === 'floating' ? 'db-sidebar-floating' : '',
        isCollapsed ? 'w-[76px] px-1' : mobile ? 'w-[220px] px-1' : 'w-[240px] px-1',
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

        <div className={isCollapsed ? 'flex flex-col items-center gap-2 text-white' : 'flex items-center gap-2 text-white'}>
          <NotificationBell />
          {mobile && (
            <>
              <IconTip label="Falar com o suporte" placement="bottom">
                <NavLink
                  to="/ajuda/suporte"
                  onClick={onNavigate}
                  aria-label="Falar com o suporte"
                  className="relative rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <IconMessage size={22} />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" aria-hidden />
                </NavLink>
              </IconTip>
              <IconTip label="Ajuda" placement="bottom">
                <NavLink
                  to="/ajuda/base-conhecimento"
                  onClick={onNavigate}
                  aria-label="Ajuda"
                  className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <IconHelpCircle size={22} />
                </NavLink>
              </IconTip>
            </>
          )}
          {!mobile && (
            <IconTip
              label={
                forcedCollapsed
                  ? 'Menu minimizado automaticamente (tela estreita)'
                  : isCollapsed
                    ? 'Expandir menu'
                    : 'Recolher menu'
              }
              placement="bottom"
            >
              <button
                type="button"
                onClick={toggleCollapse}
                disabled={forcedCollapsed}
                aria-label={
                  forcedCollapsed
                    ? 'Menu minimizado automaticamente (tela estreita)'
                    : isCollapsed
                      ? 'Expandir menu'
                      : 'Recolher menu'
                }
                className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white/60"
              >
                <IconPanelLeft size={18} />
              </button>
            </IconTip>
          )}
        </div>
      </div>

      {/* Profile card — button que abre dropdown "Minha conta" / "Assinatura"
          com animação (fade + slide). Colapsado → navega direto pra /perfil. */}
      <div ref={profileRef} className="relative mt-3">
        <button
          type="button"
          onClick={() => setProfileOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          className={[
            'flex w-full items-center rounded-xl text-left transition-opacity hover:opacity-90',
            isCollapsed
              ? 'h-11 justify-center'
              : mobile
                ? 'gap-3 px-1 py-2'
                : 'gap-3 px-3 py-2.5',
          ].join(' ')}
        >
          <span
            className={[
              'grid shrink-0 place-items-center overflow-hidden bg-[#FCE4EA] font-bold text-[#A84065] ring-1 ring-inset ring-white/25',
              mobile ? 'h-10 w-10 rounded-[10px] text-base' : 'h-9 w-9 rounded-[10px] text-sm',
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
                <IconChevron size={11} className={`transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
              </span>
            </span>
          )}
        </button>

        {/* Dropdown "Minha conta". Colapsado: flyout à direita (largura fixa).
            Expandido: abre abaixo do card, na largura do sidebar. */}
        <div
          role="menu"
          aria-hidden={!profileOpen}
          className={[
            'absolute z-50 origin-top overflow-hidden rounded-xl border border-white/[0.1] bg-ink-soft p-1.5 shadow-[var(--shadow-pop)]',
            'transition-all duration-200 ease-out',
            isCollapsed ? 'bottom-0 left-full ml-2 w-56' : 'inset-x-0 top-full mt-2',
            profileOpen
              ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0',
          ].join(' ')}
        >
            {/* FASE RBAC: seletor de empresa ativa — só aparece com >1 conta.
                Fecha o dropdown e, no mobile, o drawer ao trocar. */}
            {hasMultipleCompanies && (
              <>
                <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                  Empresa ativa
                </p>
                <CompanySwitcher
                  className="db-company-switcher"
                  onSwitched={() => { setProfileOpen(false); onNavigate?.(); }}
                />
                <div className="my-1 border-t border-white/[0.08]" />
              </>
            )}
            <button
              type="button"
              onClick={() => { setProfileOpen(false); setMinhaContaOpen(true); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/[0.08]"
              role="menuitem"
            >
              <IconUser size={16} className="text-white/70" />
              Minha conta
            </button>
            <NavLink
              to="/perfil/assinatura"
              onClick={() => { setProfileOpen(false); onNavigate?.(); }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white transition-colors hover:bg-white/[0.08]"
              role="menuitem"
            >
              <IconCreditCard size={16} className="text-white/70" />
              Assinatura
            </NavLink>
            <NavLink
              to="/perfil/adicionais"
              onClick={() => { setProfileOpen(false); onNavigate?.(); }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white transition-colors hover:bg-white/[0.08]"
              role="menuitem"
            >
              <IconSparkles size={16} className="text-white/70" />
              Adicionais
            </NavLink>
            <div className="my-1 border-t border-white/[0.08]" />
            <button
              type="button"
              onClick={async () => {
                setProfileOpen(false);
                try {
                  await signOut();
                } finally {
                  // Full reload — signOut() não invalida a session cache do Better
                  // Auth instantaneamente. navigate() faria ProtectedRoutes ler
                  // stale session e re-roteia pra Painel. window.location.href
                  // reset o SPA todo e a session cache junto.
                  window.location.href = '/login';
                }
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger/10"
              role="menuitem"
            >
              <IconLogout size={16} />
              Sair
            </button>
          </div>
      </div>

      <div ref={createRef} className="relative mt-3">
        {isCollapsed ? (
          <Tooltip delay={150}>
            <Tooltip.Trigger className="contents">
              <button
                type="button"
                onClick={handleCreateClick}
                aria-label="Novo"
                aria-expanded={createOpen}
                className="grid h-10 w-full place-items-center rounded-xl bg-[var(--sp-primary-fg)] text-[#3740C8] transition-opacity hover:opacity-90"
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
            className="h-10 w-full justify-center gap-2 rounded-xl bg-[var(--sp-primary-fg)] font-semibold text-[#3740C8] shadow-none hover:opacity-90"
            onClick={handleCreateClick}
            aria-expanded={createOpen}
            aria-haspopup="menu"
          >
            Novo
            <IconPlus size={16} />
          </Button>
        )}

        {/* Dropdown inline "Novo" — MESMO em mobile e desktop (não é drawer).
            Seções:
              - Principal (1 linha)
              - Cadastros (2 linhas, grid 4 cols)
              - Financeiro (1 linha, grid 4 cols)
            Largura responsiva: no mobile o rail é estreito (~220px) então o
            dropdown extravasa pra direita sobre o backdrop — clampado ao
            viewport pra nunca cortar. */}
        <div
          role="menu"
          aria-hidden={!createOpen}
          className={[
            'absolute left-0 top-full z-50 mt-2 max-h-[min(560px,72vh)] w-[min(336px,calc(100vw-1.5rem))] origin-top-left overflow-y-auto rounded-2xl border border-black/[0.06] bg-warm-white p-3 shadow-[var(--shadow-pop)]',
            'transition-[opacity,transform] duration-200 ease-out',
            createOpen
              ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none -translate-y-1.5 scale-[0.98] opacity-0',
          ].join(' ')}
        >
            {CREATE_GROUPS.map((group) => (
              <div key={group.label} className="mb-3 last:mb-0">
                <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9AA0A6]">
                  {group.label}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {group.items.map((item) => {
                    const { label, icon: Icon, disabled = false, disabledReason } = item;
                    return (
                    <button
                      key={`${group.label}-${label}`}
                      type="button"
                      role="menuitem"
                      onClick={() => (disabled ? undefined : quickCreate(item))}
                      disabled={disabled}
                      title={disabled ? disabledReason ?? 'Em breve' : label}
                      className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink text-gold">
                        <Icon size={16} />
                      </span>
                      <span className="w-full truncate text-center text-[11px] font-normal leading-tight text-ink">{label}</span>
                    </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>

      <ScrollShadow
        className="db-sidebar-scroll -mr-1 mt-3 flex-1 pr-1 scrollbar-none"
      >
        <nav className="flex flex-col gap-1">
          {visibleNavigation.map((entry) => (isCollapsed ? renderCollapsedEntry(entry) : renderExpandedEntry(entry)))}
          {/* Ajuda / Configurações / Indique e ganhe seguem a ordem do menu
              (não são mais pinned no rodapé — scrollam junto com o resto). */}
          {visibleFooter.map((entry) => (isCollapsed ? renderCollapsedEntry(entry) : renderExpandedEntry(entry)))}
          {/* Mobile: Sair segue a ordem também, como último item da lista. */}
          {mobile && !isCollapsed && (
            <button
              type="button"
              onClick={async () => {
                onNavigate?.();
                try {
                  await signOut();
                } finally {
                  window.location.href = '/login';
                }
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/10"
            >
              <IconLogout size={18} />
              Sair da conta
            </button>
          )}
          {!isCollapsed && <div className="px-2.5 pt-3 text-[10px] text-white/35">{APP_VERSION}</div>}
        </nav>
      </ScrollShadow>

      {/* Instalar como app (PWA) — só aparece quando o navegador oferece o prompt. */}
      <div className="mt-2">
        <InstallPwaButton collapsed={isCollapsed} />
      </div>

      {/* Zoom de acessibilidade (aproximar/afastar), salvo por dispositivo —
          pinned no rodapé do sidebar (desktop e menu mobile). */}
      <div className="mt-2">
        <ZoomControls collapsed={isCollapsed} />
      </div>

      {/* Não existe atalho de CRM aqui: o grupo "CRM" do menu (Atendimento,
          Contatos, Kanban, IA) aparece em TODO plano — com cadeado quando a
          feature não está inclusa —, então um segundo caminho só duplicava. */}

      <MinhaContaDrawer isOpen={minhaContaOpen} onClose={() => setMinhaContaOpen(false)} />
    </aside>
  );
}
