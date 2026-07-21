import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Input } from '@heroui/react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import {
  IconCalendar,
  IconChart,
  IconChevron,
  IconCreditCard,
  IconDollar,
  IconInfo,
  IconLayers,
  IconMegaphone,
  IconPercent,
  IconReceipt,
  IconScissors,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconTag,
  IconUsers,
} from '../components/icons';
import {
  useHelpCategoryList,
  useHelpFaq,
  useHelpSearch,
  type HelpArticle,
} from '../hooks/useHelpArticles';

/**
 * Central de Ajuda — SalonPass.
 *
 * Reproduz o padrão Belasis (busca no topo + FAQs + categorias) mas todo o
 * conteúdo vem do backend (docs/help/*.md indexados por HelpService).
 *
 * A rota /ajuda e as subrotas /ajuda/{suporte,base-conhecimento,feedback,
 * novidades} apontam pra este mesmo componente e disparam o strip de abas
 * abaixo do header — enquanto os endpoints específicos ainda não existem, as
 * abas "Suporte", "Feedback" e "Novidades" mostram placeholders honestos ao
 * invés de páginas em branco separadas.
 */

const TAB_ROUTES = ['/ajuda', '/ajuda/base-conhecimento', '/ajuda/suporte', '/ajuda/feedback', '/ajuda/novidades'] as const;
type TabRoute = (typeof TAB_ROUTES)[number];

interface TabDef {
  to: TabRoute;
  label: string;
}

const TABS: TabDef[] = [
  { to: '/ajuda', label: 'Central' },
  { to: '/ajuda/base-conhecimento', label: 'Base de conhecimento' },
  { to: '/ajuda/suporte', label: 'Suporte' },
  { to: '/ajuda/feedback', label: 'Feedback' },
  { to: '/ajuda/novidades', label: 'Novidades' },
];

interface CategoryDef {
  slug: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

/**
 * Ordem e ícones das categorias mostradas em "Explorar por categoria".
 * Os slugs batem com o frontmatter `category:` dos .md em docs/help/.
 */
const CATEGORIES: CategoryDef[] = [
  { slug: 'agenda', label: 'Agenda', description: 'Horários, encaixes e status.', icon: <IconCalendar size={20} /> },
  { slug: 'comandas', label: 'Comandas', description: 'Abrir, lançar itens e receber.', icon: <IconReceipt size={20} /> },
  { slug: 'clientes', label: 'Clientes', description: 'Cadastro, histórico e ficha.', icon: <IconUsers size={20} /> },
  { slug: 'servicos', label: 'Serviços', description: 'Preço, duração e catálogo.', icon: <IconScissors size={20} /> },
  { slug: 'produtos', label: 'Produtos', description: 'Estoque, marcas e categorias.', icon: <IconTag size={20} /> },
  { slug: 'vendas', label: 'Pacotes e assinaturas', description: 'Venda recorrente e sessões.', icon: <IconLayers size={20} /> },
  { slug: 'financeiro', label: 'Financeiro', description: 'Contas, transações e comissões.', icon: <IconDollar size={20} /> },
  { slug: 'profissionais', label: 'Profissionais', description: 'Cadastro, comissões e agenda.', icon: <IconPercent size={20} /> },
  { slug: 'marketing', label: 'Marketing', description: 'Promoções, avaliações e cashback.', icon: <IconMegaphone size={20} /> },
  { slug: 'relatorios', label: 'Relatórios', description: 'DRE, vendas e desempenho.', icon: <IconChart size={20} /> },
  { slug: 'conta', label: 'Conta e assinatura', description: 'Plano, cobrança e faturas.', icon: <IconCreditCard size={20} /> },
  { slug: 'configuracoes', label: 'Configurações', description: 'Empresa, integrações e times.', icon: <IconSettings size={20} /> },
  { slug: 'geral', label: 'Geral', description: 'Painel, notificações e mais.', icon: <IconSparkles size={20} /> },
];

const CARD_CLS = 'border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]';

/** Mapeia rótulo humano pra chip de categoria, com fallback pro próprio slug. */
function labelForCategory(slug: string): string {
  const found = CATEGORIES.find((c) => c.slug === slug);
  return found ? found.label : slug.charAt(0).toUpperCase() + slug.slice(1);
}

function currentTab(pathname: string): TabRoute {
  const match = TAB_ROUTES.find((r) => r === pathname);
  return match ?? '/ajuda';
}

export function AjudaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = currentTab(location.pathname);

  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Debounce 300ms — evita bater no backend a cada tecla.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(rawQuery.trim()), 300);
    return () => window.clearTimeout(t);
  }, [rawQuery]);

  // Fechar dropdown ao clicar fora.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const faq = useHelpFaq();
  const search = useHelpSearch(debouncedQuery);
  const categoryList = useHelpCategoryList(selectedCategory ?? undefined);

  const searchResults = search.data ?? [];
  const hasQuery = debouncedQuery.length >= 2;

  const cardsToShow: HelpArticle[] = useMemo(() => {
    if (selectedCategory) return categoryList.data ?? [];
    return faq.data ?? [];
  }, [selectedCategory, categoryList.data, faq.data]);

  const isLoadingCards = selectedCategory
    ? categoryList.isLoading
    : faq.isLoading;
  const cardsError = selectedCategory ? categoryList.isError : faq.isError;

  function openArticle(slug: string) {
    setSearchOpen(false);
    navigate(`/ajuda/artigo/${slug}`);
  }

  const isPlaceholderTab =
    activeTab === '/ajuda/suporte' ||
    activeTab === '/ajuda/feedback' ||
    activeTab === '/ajuda/novidades';

  return (
    <div>
      <PageHeader
        title="Central de ajuda"
        subtitle="Guias, tutoriais e respostas rápidas sobre o SalonPass"
      />

      {/* Strip de abas */}
      <div className="mb-5 -mx-3 overflow-x-auto sm:mx-0">
        <div className="flex min-w-max gap-1 px-3 sm:px-0">
          {TABS.map((t) => {
            const active = t.to === activeTab;
            return (
              <button
                key={t.to}
                type="button"
                onClick={() => navigate(t.to)}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-ink text-warm-white'
                    : 'bg-warm-white text-muted hover:text-foreground border border-[var(--color-soft-border)]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Busca */}
      <div ref={containerRef} className="relative mb-6">
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-soft-border)] bg-warm-white px-4 py-3 shadow-[var(--shadow-card)] focus-within:border-gold/60">
          <span className="text-muted">
            <IconSearch size={20} />
          </span>
          <Input
            ref={inputRef}
            value={rawQuery}
            onChange={(e) => {
              setRawQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Buscar ajuda..."
            aria-label="Buscar na central de ajuda"
            className="w-full border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-0"
          />
          {rawQuery && (
            <button
              type="button"
              onClick={() => {
                setRawQuery('');
                setDebouncedQuery('');
                setSearchOpen(false);
                inputRef.current?.focus();
              }}
              className="text-xs font-medium text-muted hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Dropdown de resultados */}
        {searchOpen && hasQuery && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
            {search.isLoading ? (
              <div className="px-4 py-3 text-sm text-muted">Buscando…</div>
            ) : search.isError ? (
              <div className="px-4 py-3 text-sm text-danger">Erro ao buscar.</div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted">
                Nada encontrado para "{debouncedQuery}".
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-soft-border)]">
                {searchResults.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => openArticle(a.slug)}
                      className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-gold/[0.06]"
                    >
                      <div className="flex w-full items-start justify-between gap-3">
                        <span className="text-sm font-semibold text-foreground">
                          {a.title}
                        </span>
                        <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                          {labelForCategory(a.category)}
                        </span>
                      </div>
                      {a.excerpt && (
                        <span className="text-xs text-muted">{a.excerpt}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {isPlaceholderTab ? (
        <Card className={CARD_CLS}>
          <Card.Content className="p-8 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gold/15 text-gold-strong">
              <IconInfo size={22} />
            </div>
            <p className="text-base font-semibold text-foreground">
              {TABS.find((t) => t.to === activeTab)?.label} em breve
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Enquanto isso, use a busca acima ou explore a base de conhecimento
              para encontrar o que precisa.
            </p>
          </Card.Content>
        </Card>
      ) : (
        <>
          {/* Categorias */}
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-base font-semibold text-foreground">
                Explorar por categoria
              </h2>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs font-medium text-muted hover:text-foreground"
                >
                  Limpar filtro
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {CATEGORIES.map((c) => {
                const active = selectedCategory === c.slug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() =>
                      setSelectedCategory(active ? null : c.slug)
                    }
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? 'border-gold/60 bg-gold/[0.08]'
                        : 'border-[var(--color-soft-border)] bg-warm-white hover:border-gold/40 hover:bg-gold/[0.04]'
                    }`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-gold">
                      {c.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        {c.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {c.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Cards (FAQ ou lista da categoria) */}
          <section>
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-base font-semibold text-foreground">
                {selectedCategory
                  ? `Artigos — ${labelForCategory(selectedCategory)}`
                  : 'Perguntas frequentes'}
              </h2>
            </div>

            {isLoadingCards ? (
              <LoadingState />
            ) : cardsError ? (
              <ErrorState
                message="Não foi possível carregar os artigos."
                onRetry={() =>
                  selectedCategory ? categoryList.refetch() : faq.refetch()
                }
              />
            ) : cardsToShow.length === 0 ? (
              <EmptyState
                icon={<IconInfo size={28} />}
                title="Nenhum artigo por aqui ainda"
                description={
                  selectedCategory
                    ? 'Tente outra categoria ou use a busca.'
                    : 'Volte em breve — estamos adicionando conteúdo.'
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cardsToShow.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openArticle(a.slug)}
                    className="group flex h-full flex-col rounded-2xl border border-[var(--color-soft-border)] bg-warm-white p-4 text-left shadow-[var(--shadow-card)] transition-colors hover:border-gold/50"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                        {labelForCategory(a.category)}
                      </span>
                      <span className="text-muted group-hover:text-foreground">
                        <IconChevron size={16} className="-rotate-90" />
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {a.title}
                    </p>
                    {a.excerpt && (
                      <p className="mt-1 flex-1 text-xs text-muted">
                        {a.excerpt}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
