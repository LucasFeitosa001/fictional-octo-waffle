import { Skeleton } from '@heroui/react';

/**
 * Skeleton loaders reutilizáveis (HeroUI v3) para os estados de carregamento
 * INICIAL das listagens — substituem o `<LoadingState />` (spinner de tela
 * cheia) por um placeholder que imita o layout final, evitando o "salto" da UI.
 *
 * API do Skeleton v3 (`@heroui/react`): é um placeholder PURO — só aceita
 * `className` (tamanho/forma via Tailwind) e `animationType` ("shimmer" |
 * "pulse" | "none"). Não há mais `isLoaded`/`children` como na v2; o padrão é
 * renderização condicional:
 *
 *   {query.isLoading ? <TableSkeleton /> : <Tabela />}
 *
 * Estilo do app: superfícies em `bg-card`, bordas `border-line`, cantos
 * `rounded-2xl`/`rounded-xl` e sombra `shadow-[var(--shadow-card)]`.
 */

/** Célula de texto genérica (barra arredondada). */
function Bar({ className = '' }: { className?: string }) {
  return <Skeleton className={`h-3.5 rounded-md ${className}`} />;
}

/**
 * Skeleton de LISTAGEM — imita a tabela (desktop) e os cards (mobile) usados nas
 * páginas de cadastros/financeiro. Some no desktop abaixo de `md`, onde entram
 * os cards (padrão do app: tabela `md:block`, cards `md:hidden`).
 *
 * @param rows    quantidade de linhas fantasma (default 6)
 * @param columns colunas da tabela desktop, excluindo checkbox/ações (default 5)
 * @param withCheckbox reserva a 1ª coluna estreita do checkbox (default true)
 * @param withActions  reserva a última coluna de ações (default true)
 * @param card    envolve num cartão com borda/sombra (default true); use false
 *                quando a página já renderiza a lista dentro de um `<Card>`.
 * @param variant "both" (default) renderiza tabela (desktop) + cards (mobile);
 *                "desktop"/"mobile" renderizam apenas um lado — útil quando a
 *                página já separa os blocos `md:block` / `md:hidden`.
 */
export function TableSkeleton({
  rows = 6,
  columns = 5,
  withCheckbox = true,
  withActions = true,
  card = true,
  variant = 'both',
  firstColAvatar = true,
}: {
  rows?: number;
  columns?: number;
  withCheckbox?: boolean;
  withActions?: boolean;
  card?: boolean;
  variant?: 'both' | 'desktop' | 'mobile';
  /** 1ª coluna com avatar redondo + nome (listas de pessoas/itens). Desative em
   *  tabelas cuja 1ª coluna é um número/código (ex.: ticket de comanda). */
  firstColAvatar?: boolean;
}) {
  const bodyRows = Array.from({ length: rows });
  const dataCols = Array.from({ length: columns });

  // `both`: alterna tabela↔cards no breakpoint md. `desktop`/`mobile`: o lado
  // pedido fica sempre visível (a própria página já controla o breakpoint).
  const showDesktop = variant !== 'mobile';
  const showMobile = variant !== 'desktop';
  const desktopVis = variant === 'both' ? 'hidden md:block' : 'block';
  const mobileVis = variant === 'both' ? 'md:hidden' : '';

  const desktop = (
    <div
      className={[
        card
          ? 'overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]'
          : '',
        desktopVis,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            {withCheckbox && (
              <th className="w-10 px-4 py-3">
                <Skeleton className="h-4 w-4 rounded" />
              </th>
            )}
            {dataCols.map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Bar className={i === 0 ? 'w-24' : 'w-16'} />
              </th>
            ))}
            {withActions && <th className="w-20 px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((_, r) => (
            <tr key={r} className="border-b border-line last:border-0">
              {withCheckbox && (
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-4 rounded" />
                </td>
              )}
              {dataCols.map((_, c) => (
                <td key={c} className="px-4 py-3">
                  {c === 0 && firstColAvatar ? (
                    // 1ª coluna: avatar + nome (padrão das listagens do app).
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                      <Bar className="w-32" />
                    </div>
                  ) : (
                    <Bar className={c === columns - 1 ? 'w-16' : 'w-24'} />
                  )}
                </td>
              ))}
              {withActions && (
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1.5">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const mobile = (
    <ul
      className={['flex flex-col gap-3', mobileVis].filter(Boolean).join(' ')}
      aria-hidden
    >
      {bodyRows.map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3.5 rounded-2xl border border-line bg-card px-4 py-4 shadow-[var(--shadow-card)]"
        >
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bar className="w-2/3" />
            <Bar className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div role="status" aria-label="Carregando lista" className="w-full">
      {showDesktop && desktop}
      {showMobile && mobile}
    </div>
  );
}

/**
 * Skeleton de um cartão genérico (bloco de conteúdo com título + linhas). Útil
 * para painéis/detalhes que carregam isolados.
 */
export function CardSkeleton({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={`rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] ${className}`}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Bar className="w-40" />
          <Bar className="h-3 w-24" />
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Bar key={i} className={i === lines - 1 ? 'w-2/3' : 'w-full'} />
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton de um card de indicador (KPI) — rótulo curto em cima, número grande
 * embaixo. Bom para grids de estatísticas (painel/relatórios).
 */
export function StatCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Carregando indicador"
      className={`rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] ${className}`}
    >
      <div className="flex items-center justify-between">
        <Bar className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="mt-3 h-7 w-28 rounded-lg" />
      <Bar className="mt-2 h-3 w-16" />
    </div>
  );
}
