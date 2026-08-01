import type { ComponentType, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import {
  IconCalendar,
  IconClock,
  IconDollar,
  IconHome,
  IconInfo,
  IconLayers,
  IconStar,
} from '../../components/icons';
import { BackToReports } from './reportShared';

/* -------------------------------------------------------------------------- */
/*  Fonte única da navegação do módulo Relatórios.                            */
/*                                                                            */
/*  Os submenus (Financeiro / Agendamentos / Estoque) do Belasis apontavam    */
/*  para rotas `/reports/...` que NÃO existiam no router — eram botões mortos  */
/*  (navegação quebrada). Aqui centralizamos as listas e renderizamos como     */
/*  <NavLink> reais, e as rotas são registradas no App.tsx. Relatórios que     */
/*  dependem de backend novo ficam marcados `soon` (badge "Em breve").         */
/* -------------------------------------------------------------------------- */

type IconType = ComponentType<{ size?: number; className?: string }>;

export interface ReportNavItem {
  key: string;
  label: string;
  to: string;
  icon: IconType;
  /** Relatório que depende de backend novo — rota existe mas mostra "Em breve". */
  soon?: boolean;
}

// ---- Submenu "Financeiro" (ordem idêntica ao Belasis) ----------------------
export const FINANCIAL_REPORTS: ReportNavItem[] = [
  { key: 'home', label: 'Início', to: '/relatorios', icon: IconHome },
  { key: 'dre', label: 'Resultados Financeiros', to: '/reports/financial/dre', icon: IconDollar },
  { key: 'service', label: 'Resultado Líquido de Serviços', to: '/reports/financial/service-revenue', icon: IconDollar },
  { key: 'product', label: 'Resultado Líquido de Produtos', to: '/reports/financial/product-revenue', icon: IconDollar },
  { key: 'projection', label: 'Projeção de Faturamento', to: '/reports/financial/billing-projection', icon: IconDollar },
  { key: 'cash', label: 'Fluxo de Caixa', to: '/reports/financial/cash-movements', icon: IconDollar },
  { key: 'recs', label: 'Recebimentos', to: '/reports/financial/bill-recs', icon: IconDollar },
  { key: 'pays', label: 'Despesas', to: '/reports/financial/bill-pays', icon: IconDollar },
  { key: 'extract', label: 'Extrato de Contas', to: '/reports/financial/extract', icon: IconDollar },
  { key: 'movements', label: 'Extrato de Movimentações', to: '/reports/financial/extract-movements', icon: IconDollar },
  { key: 'history', label: 'Histórico de caixa', to: '/financeiro/caixas/historico', icon: IconClock },
];

// ---- Submenu "Agendamentos" ------------------------------------------------
export const CALENDAR_REPORTS: ReportNavItem[] = [
  { key: 'home', label: 'Início', to: '/relatorios', icon: IconHome },
  { key: 'all', label: 'Todos os Agendamentos', to: '/reports/calendars/all', icon: IconCalendar },
  { key: 'deleted', label: 'Agendamentos excluídos', to: '/reports/calendars/deleted', icon: IconCalendar },
  { key: 'origin', label: 'Origem dos Agendamentos', to: '/reports/calendars/origin', icon: IconCalendar },
  { key: 'creation', label: 'Criação de Agendamento', to: '/reports/calendars/creation', icon: IconCalendar },
  { key: 'care', label: 'Cuidados para Hoje', to: '/reports/calendars/care-messages-today', icon: IconCalendar },
];

// ---- Submenu "Vendas" ------------------------------------------------------
// A categoria Vendas tem um relatório só; a régua existe para voltar ao início
// do módulo sem ter que caçar o "Voltar". Ver estudo 63.
export const SALES_REPORTS: ReportNavItem[] = [
  { key: 'home', label: 'Início', to: '/relatorios', icon: IconHome },
  { key: 'vendas', label: 'Vendas', to: '/relatorios/vendas', icon: IconDollar },
];

// ---- Submenu "Estoque" -----------------------------------------------------
export const INVENTORY_REPORTS: ReportNavItem[] = [
  { key: 'home', label: 'Início', to: '/relatorios', icon: IconHome },
  { key: 'stock', label: 'Estoque atual', to: '/reports/inventory/stock', icon: IconLayers },
  { key: 'movements', label: 'Movimentação de Estoque', to: '/reports/inventory/movements', icon: IconLayers },
  { key: 'purchases', label: 'Compras', to: '/reports/inventory/purchases', icon: IconLayers },
  { key: 'products-services', label: 'Lista de Produtos e Serviços', to: '/reports/inventory/products-services', icon: IconLayers },
  { key: 'suggestion', label: 'Sugestão de compra', to: '/reports/inventory/suggestion', icon: IconLayers },
  { key: 'consumed', label: 'Produtos consumidos', to: '/reports/inventory/consumed', icon: IconLayers },
];

/** Barra de categorias do topo do módulo Relatórios (estilo Belasis). */
const INVENTORY_CATEGORIES: { label: string; to: string }[] = [
  { label: 'Favoritos', to: '/relatorios' },
  { label: 'Financeiro', to: '/reports/financial/dre' },
  { label: 'Agendamentos', to: '/reports/calendars/all' },
  { label: 'Clientes', to: '/relatorios/clientes' },
  { label: 'Vendas', to: '/relatorios/vendas' },
  { label: 'Estoque', to: '/reports/inventory/stock' },
  { label: 'Notas Fiscais', to: '/reports/invoices' },
  { label: 'Ranking', to: '/relatorios/ranking' },
  { label: 'Mensagens', to: '/relatorios/mensagens' },
];

/* ---------------------------------------------------------------- pieces --- */

/**
 * Barra de categorias do módulo Relatórios.
 *
 * Estava duplicada dentro de um shell e, na página de Vendas, reimplementada
 * como `<button>` SEM onClick — clicar não fazia nada, que é o "clico e não
 * alterna" que o dono relatou. Aqui é `<NavLink>`: navega de verdade.
 * Ver estudo 63.
 */
export function ReportCategoriesBar({ ativa }: { ativa: string }) {
  return (
    <div className="report-no-print mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {INVENTORY_CATEGORIES.map((c) => {
        const active = c.label === ativa;
        return (
          <NavLink
            key={c.label}
            to={c.to}
            className={[
              'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-line bg-card text-muted-ink hover:text-ink',
            ].join(' ')}
          >
            {c.label}
          </NavLink>
        );
      })}
    </div>
  );
}


/** Submenu vertical (Financeiro / Agendamentos) — clone do menu lateral Belasis. */
export function ReportSubmenu({
  items,
  activeKey,
}: {
  items: ReportNavItem[];
  activeKey: string;
}) {
  return (
    <nav className="report-no-print shrink-0 rounded-2xl border border-line bg-card p-2 shadow-[var(--shadow-card)] lg:w-[320px]">
      <ul className="flex flex-col gap-0.5">
        {items.map((r) => {
          const active = r.key === activeKey;
          const Icon = r.icon;
          return (
            <li key={r.key}>
              <NavLink
                to={r.to}
                className={[
                  'flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm transition-colors',
                  active
                    ? 'font-semibold text-primary-strong [background:color-mix(in_oklab,var(--sp-primary)_12%,transparent)]'
                    : 'text-ink hover:bg-canvas',
                ].join(' ')}
              >
                <Icon size={18} className={active ? 'text-primary-strong' : 'text-muted-ink'} />
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                {r.soon ? (
                  <span className="shrink-0 rounded-full bg-muted-ink/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-ink">
                    Em breve
                  </span>
                ) : active ? (
                  <IconStar size={16} className="shrink-0 text-gold" />
                ) : null}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Casca das páginas de relatório Financeiro: back + header + submenu + conteúdo. */
export function FinancialReportShell({
  activeKey,
  title,
  subtitle,
  actions,
  children,
}: {
  activeKey: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <BackToReports />
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <ReportSubmenu items={FINANCIAL_REPORTS} activeKey={activeKey} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Casca das páginas de relatório de Agendamentos. */
export function CalendarReportShell({
  activeKey,
  title,
  subtitle,
  actions,
  children,
}: {
  activeKey: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <BackToReports />
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <ReportSubmenu items={CALENDAR_REPORTS} activeKey={activeKey} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Aside do módulo Estoque (clone do menu lateral do Belasis). */
function InventoryAside({ activeKey }: { activeKey: string }) {
  return (
    <aside className="report-no-print shrink-0 overflow-hidden rounded-xl border border-line bg-card p-1.5 shadow-[var(--shadow-card)] lg:w-72">
      <ul className="flex flex-col">
        {INVENTORY_REPORTS.map((r) => {
          const active = r.key === activeKey;
          const home = r.key === 'home';
          return (
            <li key={r.key}>
              <NavLink
                to={r.to}
                className={[
                  'group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  active ? 'bg-primary/10 font-semibold text-primary' : 'text-ink hover:bg-primary/5',
                ].join(' ')}
              >
                <span className={active ? 'text-primary' : 'text-muted-ink'} aria-hidden>
                  {home ? <IconHome size={17} /> : <IconLayers size={17} />}
                </span>
                <span className="flex-1 truncate">{r.label}</span>
                {!home &&
                  (r.soon ? (
                    <span className="rounded-full bg-muted-ink/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-ink">
                      breve
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-ink">
                      <IconInfo size={15} className="opacity-70" />
                      <IconStar size={15} className={active ? 'text-primary' : 'opacity-70'} />
                    </span>
                  ))}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/** Casca das páginas de relatório de Estoque: barra de categorias + aside + conteúdo. */
export function InventoryReportShell({
  activeKey,
  title,
  subtitle,
  children,
}: {
  activeKey: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <BackToReports />
      <h1 className="text-xl font-semibold text-ink">{title ?? 'Relatórios'}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-muted-ink">{subtitle}</p>}

      <ReportCategoriesBar ativa="Estoque" />

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <InventoryAside activeKey={activeKey} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Painel "Em breve" para relatórios que dependem de backend novo. */
export function ComingSoonPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-8 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gold/15 text-gold-strong">
        <IconClock size={22} />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-ink">{description}</p>
      <span className="mt-4 inline-flex items-center rounded-full bg-muted-ink/10 px-3 py-1 text-xs font-semibold text-muted-ink">
        Em breve
      </span>
    </div>
  );
}
