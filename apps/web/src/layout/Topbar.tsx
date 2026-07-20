import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from '@heroui/react';
import { IconChevron, IconLogout, IconSearch, IconSettings, IconSparkles } from '../components/icons';
import { NotificationBell } from '../components/NotificationBell';
import { signOut, useSession } from '../lib/auth';
import { initials } from '../lib/format';

/** Per-route header copy. Longest matching prefix wins. */
const PAGE_META: { path: string; title: string; description: string }[] = [
  { path: '/agenda', title: 'Agenda', description: 'Seus horários e agendamentos' },
  { path: '/agendamentos', title: 'Agendamentos', description: 'Histórico e confirmações de horários' },
  { path: '/comandas', title: 'Comandas', description: 'Vendas e atendimentos abertos' },
  { path: '/pacotes', title: 'Pacotes', description: 'Combos de serviços' },
  { path: '/assinaturas', title: 'Assinaturas', description: 'Planos recorrentes' },
  { path: '/ia-atendimento', title: 'IA Atendimento', description: 'Seu atendente virtual' },
  { path: '/financeiro/transacoes', title: 'Transações', description: 'Entradas e saídas do caixa' },
  { path: '/financeiro/contas', title: 'Contas e métodos', description: 'Contas e formas de pagamento' },
  { path: '/financeiro/cadastros/categorias', title: 'Categorias', description: 'Categorias de transações financeiras' },
  { path: '/financeiro/cadastros/formas-pagamento', title: 'Formas de pagamento', description: 'Configuração de meios de pagamento' },
  { path: '/financeiro/cadastros/contas', title: 'Contas bancárias', description: 'Contas ativas e integrações' },
  { path: '/financeiro/belasis-pay', title: 'Belasis Pay', description: 'Cadastro do gateway de pagamento' },
  { path: '/financeiro/caixas-abertos', title: 'Caixas abertos', description: 'Movimentações dos caixas em aberto' },
  { path: '/financeiro/caixas', title: 'Caixas abertos', description: 'Movimentações dos caixas em aberto' },
  { path: '/financeiro/historico-caixa', title: 'Histórico de caixa', description: 'Fechamentos e conferências' },
  { path: '/financeiro/notas-fiscais', title: 'Notas Fiscais', description: 'Emissão e acompanhamento' },
  { path: '/financeiro', title: 'Painel financeiro', description: 'A saúde financeira do studio' },
  { path: '/vendas-por-assinatura', title: 'Assinaturas', description: 'Planos recorrentes' },
  { path: '/caixa', title: 'Caixa', description: 'Abertura e fechamento de caixa' },
  { path: '/comissoes/config', title: 'Configurações de comissão', description: 'Regras de comissionamento' },
  { path: '/comissoes', title: 'Comissões', description: 'Resumo das comissões da equipe' },
  { path: '/clientes', title: 'Clientes', description: 'Sua base de clientes' },
  { path: '/profissionais', title: 'Profissionais', description: 'Sua equipe de atendimento' },
  { path: '/fornecedores', title: 'Fornecedores', description: 'Parceiros e insumos' },
  { path: '/servicos', title: 'Serviços', description: 'Catálogo de serviços' },
  { path: '/produtos', title: 'Produtos', description: 'Estoque e itens de venda' },
  { path: '/categorias', title: 'Categorias', description: 'Organização do catálogo' },
  { path: '/marcas', title: 'Marcas', description: 'Fabricantes e marcas' },
  { path: '/relatorios', title: 'Relatórios', description: 'Análises e exportações' },
  { path: '/metas', title: 'Metas', description: 'Objetivos e desempenho' },
  { path: '/marketing/link', title: 'Link de Agendamento', description: 'Seu link público de agendamento' },
  { path: '/marketing/promocoes', title: 'Promoções', description: 'Campanhas e descontos' },
  { path: '/marketing/avaliacoes', title: 'Avaliações', description: 'O feedback dos clientes' },
  { path: '/marketing/cashback', title: 'Cashback', description: 'Programa de recompensas' },
  { path: '/configuracoes', title: 'Configurações', description: 'Preferências do studio' },
  { path: '/perfil/adicionais', title: 'Adicionais', description: 'Recursos extras do seu plano' },
  { path: '/perfil', title: 'Meu perfil', description: 'Conta, acesso e plano' },
  { path: '/notificacoes', title: 'Notificações', description: 'Central de avisos e alertas' },
  { path: '/indique-e-ganhe', title: 'Indique e ganhe', description: 'Convide e ganhe recompensas' },
];

function getPageMeta(pathname: string) {
  if (pathname === '/') return { title: 'Painel', description: 'Visão geral da sua gestão' };
  const match = PAGE_META.find(
    (m) => pathname === m.path || pathname.startsWith(`${m.path}/`),
  );
  return match ?? { title: 'Painel', description: 'Visão geral da sua gestão' };
}

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { title, description } = getPageMeta(location.pathname);

  const { data: session } = useSession();
  const name = session?.user?.name ?? 'Administrador';
  const image = session?.user?.image ?? undefined;
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'Administrador';

  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/clientes?q=${encodeURIComponent(q)}`);
  }

  return (
      <header className="sticky top-0 z-30 hidden h-[72px] items-center justify-between gap-4 border-b border-[var(--color-soft-border)] bg-warm-white/80 px-6 backdrop-blur-xl lg:flex">
      {/* Full-left: section title + description + pink sparkles */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pink/12 text-pink ring-1 ring-inset ring-pink/20">
          <IconSparkles size={20} />
        </span>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate font-brand text-[17px] font-bold text-foreground">{title}</h1>
          <p className="truncate text-xs text-muted">{description}</p>
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex shrink-0 items-center gap-2.5">
        {/* Search */}
        <form onSubmit={submitSearch} className="relative hidden md:block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <IconSearch size={16} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar clientes…"
            aria-label="Pesquisar"
            className="h-10 w-[200px] rounded-xl border border-[var(--color-soft-border)] bg-white pl-9 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-muted/70 focus:border-gold focus:ring-2 focus:ring-gold/25 xl:w-[260px]"
          />
        </form>

        {/* Notifications: thin ring + pink dot */}
        <NotificationBell variant="ringed" />

        <span className="mx-0.5 h-8 w-px bg-[var(--color-soft-border)]" aria-hidden />

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2.5 rounded-xl border border-transparent py-1 pl-1 pr-2 transition-colors hover:border-[var(--color-soft-border)] hover:bg-cream"
          >
            <Avatar size="sm">
              {image && <Avatar.Image src={image} alt={name} />}
              <Avatar.Fallback className="bg-gold text-ink">
                {initials(name)}
              </Avatar.Fallback>
            </Avatar>
            <span className="hidden min-w-0 text-left leading-tight sm:block">
              <span className="block max-w-[160px] truncate text-sm font-semibold text-foreground">
                {name}
              </span>
              <span className="block truncate text-xs text-muted">{role}</span>
            </span>
            <span className={`text-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`}>
              <IconChevron size={16} />
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-[var(--color-soft-border)] bg-warm-white p-1.5 shadow-[var(--shadow-pop)]"
            >
              <div className="flex items-center gap-3 px-2.5 py-2">
                <Avatar size="sm">
                  {image && <Avatar.Image src={image} alt={name} />}
                  <Avatar.Fallback className="bg-gold text-ink">
                    {initials(name)}
                  </Avatar.Fallback>
                </Avatar>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold text-foreground">{name}</div>
                  <div className="truncate text-xs text-muted">{role}</div>
                </div>
              </div>
              <div className="my-1 h-px bg-[var(--color-soft-border)]" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/configuracoes');
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-cream"
              >
                <IconSettings size={17} /> Configurações
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => signOut()}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10"
              >
                <IconLogout size={17} /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
      </header>
  );
}
