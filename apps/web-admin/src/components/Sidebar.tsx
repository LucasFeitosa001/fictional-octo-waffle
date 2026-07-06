'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import {
  IconBox,
  IconCalendar,
  IconCash,
  IconChart,
  IconChevron,
  IconCreditCard,
  IconDollar,
  IconFolder,
  IconGift,
  IconHome,
  IconLayers,
  IconLink,
  IconLogout,
  IconMegaphone,
  IconPercent,
  IconPlus,
  IconReceipt,
  IconRepeat,
  IconScissors,
  IconSettings,
  IconSparkles,
  IconStar,
  IconTag,
  IconTarget,
  IconTruck,
  IconUsers,
} from './icons';
import { SalonpassMark } from './Brand';
import { NotificationsBell } from './NotificationsBell';
import { ProfileMenu } from './ProfileMenu';
import { signOut } from '../lib/auth';
import { APP_VERSION } from '../lib/config';

type IconType = ComponentType<{ size?: number }>;
type NavItem = { href: string; label: string; icon: IconType; exact?: boolean };
type NavGroup = { key: string; title: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    key: 'principal',
    title: 'Principal',
    items: [
      { href: '/', label: 'Painel', icon: IconHome, exact: true },
      { href: '/agenda', label: 'Agenda', icon: IconCalendar },
      { href: '/agendamentos', label: 'Agendamentos', icon: IconReceipt },
      { href: '/comandas', label: 'Comandas', icon: IconReceipt },
      { href: '/pacotes', label: 'Pacotes', icon: IconLayers },
      { href: '/assinaturas', label: 'Assinaturas', icon: IconRepeat },
    ],
  },
  {
    key: 'financeiro',
    title: 'Financeiro',
    items: [
      { href: '/financeiro', label: 'Painel financeiro', icon: IconChart, exact: true },
      { href: '/financeiro/transacoes', label: 'Transações', icon: IconDollar },
      { href: '/financeiro/contas', label: 'Contas e métodos', icon: IconCreditCard },
      { href: '/caixa', label: 'Caixa', icon: IconCash },
    ],
  },
  {
    key: 'comissoes',
    title: 'Comissões',
    items: [
      { href: '/comissoes', label: 'Resumo', icon: IconPercent, exact: true },
      { href: '/comissoes/config', label: 'Configurações', icon: IconSettings },
    ],
  },
  {
    key: 'cadastros',
    title: 'Cadastros',
    items: [
      { href: '/clientes', label: 'Clientes', icon: IconUsers },
      { href: '/profissionais', label: 'Profissionais', icon: IconScissors },
      { href: '/fornecedores', label: 'Fornecedores', icon: IconTruck },
    ],
  },
  {
    key: 'controle',
    title: 'Controle',
    items: [
      { href: '/servicos', label: 'Serviços', icon: IconScissors },
      { href: '/produtos', label: 'Produtos', icon: IconBox },
      { href: '/categorias', label: 'Categorias', icon: IconFolder },
      { href: '/marcas', label: 'Marcas', icon: IconTag },
    ],
  },
  {
    key: 'relatorios',
    title: 'Relatórios',
    items: [
      { href: '/relatorios', label: 'Relatórios', icon: IconChart, exact: true },
      { href: '/metas', label: 'Metas', icon: IconTarget },
    ],
  },
  {
    key: 'marketing',
    title: 'Marketing',
    items: [
      { href: '/link-agendamento', label: 'Link de agendamento', icon: IconLink },
      { href: '/promocoes', label: 'Promoções', icon: IconMegaphone },
      { href: '/avaliacoes', label: 'Avaliações', icon: IconStar },
      { href: '/cashback', label: 'Cashback', icon: IconGift },
    ],
  },
  {
    key: 'ia',
    title: 'Inteligência Artificial',
    items: [{ href: '/ia-atendimento', label: 'IA Atendimento', icon: IconSparkles }],
  },
  {
    key: 'outros',
    title: 'Outros',
    items: [{ href: '/configuracoes', label: 'Configurações', icon: IconSettings }],
  },
];

type QuickCreate = { href: string; label: string; icon: IconType };

const QUICK_CREATE: QuickCreate[] = [
  { href: '/agenda?new=1', label: 'Agendamento', icon: IconCalendar },
  { href: '/comandas?new=1', label: 'Comanda', icon: IconReceipt },
  { href: '/clientes?new=1', label: 'Cliente', icon: IconUsers },
  { href: '/servicos?new=1', label: 'Serviço', icon: IconScissors },
  { href: '/produtos?new=1', label: 'Produto', icon: IconBox },
  { href: '/profissionais?new=1', label: 'Profissional', icon: IconScissors },
];

const DEFAULT_OPEN: Record<string, boolean> = {
  principal: true,
  financeiro: true,
  cadastros: true,
  controle: true,
  ia: true,
};

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();

  const [open, setOpen] = useState<Record<string, boolean>>(DEFAULT_OPEN);
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (!createOpen) return;
    const onDown = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [createOpen]);

  function quickCreate(href: string) {
    setCreateOpen(false);
    onNavigate?.();
    router.push(href);
  }

  return (
    <aside className="db-sidebar flex h-full w-64 shrink-0 flex-col px-4 py-5">
      <div className="flex items-center gap-2.5 px-1">
        <SalonpassMark size={32} />
        <div className="leading-tight">
          <div className="font-brand text-[17px] font-semibold tracking-tight text-white">
            Salonpass
          </div>
          <div className="eyebrow mt-1 text-white/35">Gestão</div>
        </div>
        <div className="ml-auto">
          <NotificationsBell compact />
        </div>
      </div>

      {/* Profile row → dropdown (perfil, configurações, sair) */}
      <ProfileMenu onNavigate={onNavigate} />

      {/* Novo + (quick create) */}
      <div ref={createRef} className="relative mt-3">
        <Button
          variant="secondary"
          className="w-full bg-white font-semibold tracking-tight text-[#0a0a0a] hover:bg-white/90"
          onClick={() => setCreateOpen((v) => !v)}
          aria-expanded={createOpen}
          aria-haspopup="menu"
        >
          Novo <IconPlus size={16} />
        </Button>
        {createOpen && (
          <div
            role="menu"
            className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0c0c0d] py-1 shadow-2xl shadow-black/60"
          >
            {QUICK_CREATE.map(({ href, label, icon: Icon }) => (
              <button
                key={href}
                type="button"
                role="menuitem"
                onClick={() => quickCreate(href)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {GROUPS.map((group) => {
          const isOpen = open[group.key] ?? false;
          return (
            <div key={group.key} className="mb-1">
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={isOpen}
                className="eyebrow flex w-full items-center justify-between rounded-md px-3 py-2 text-white/40 transition-colors hover:text-white/70"
              >
                {group.title}
                <IconChevron
                  size={13}
                  className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                />
              </button>
              {isOpen && (
                <div className="mb-1 ml-3 flex flex-col gap-0.5 border-l border-white/[0.07] pl-2">
                  {group.items.map((item) => {
                    const { href, label, icon: Icon } = item;
                    const active = isActive(pathname, item);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onNavigate}
                        className={[
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors',
                          active
                            ? 'db-nav-active font-semibold'
                            : 'font-medium text-white/65 hover:bg-white/[0.06] hover:text-white',
                        ].join(' ')}
                      >
                        <Icon size={18} />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-2 border-t border-white/[0.07] pt-2">
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <IconLogout size={18} />
          Sair
        </button>
        <div className="eyebrow px-3 pt-2 text-white/25">{APP_VERSION}</div>
      </div>
    </aside>
  );
}
