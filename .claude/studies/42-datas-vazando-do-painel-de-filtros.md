# Estudo 42 — Os dois campos de data vazam para fora do painel de filtros

Relato do dono, com captura: em Comissões → Resumidas, abrir "Filtros" mostra "Data inicial" e
"Data final" lado a lado, e o segundo campo escapa da borda direita do painel.

## A conta que explica

- O painel é o `FilterAside` (`apps/web/src/components/FilterAside.tsx:42`-`:44`), largura padrão
  **`md:w-64` = 256px**, com `p-4` no cartão interno (`:57`) → sobram **~224px** de conteúdo.
- Cada campo de data carrega, por dentro, `wrapClass = 'w-full sm:w-auto sm:min-w-[10.5rem]'`
  (`apps/web/src/components/DateRangeFilter.tsx:14`) — **168px de mínimo** a partir de `sm`.
- Dois numa `grid grid-cols-2 gap-3` pedem `168 + 168 + 12 = 348px`. Não cabe em 224px, e o item
  com `min-width` explícito força a trilha do grid — daí o vazamento.

O `className="min-w-0"` que as páginas passavam não resolve: `sm:min-w-[10.5rem]` é variante
responsiva e vence o `min-w-0` simples na folha do Tailwind.

## Por que a correção é de LAYOUT, não do componente

Mesmo zerando o mínimo, 224px ÷ 2 = 112px por campo — "28/06/2026" mais o ícone do calendário não
cabem. Dois campos de data lado a lado dentro deste painel são impossíveis por aritmética, não por
estilo. A correção é empilhar; foi o que já tinha sido feito em
`ComissoesDetalhadasView.tsx` (coluna de 260px) pelo mesmo motivo.

## Onde mais acontece

`grep` por `grid-cols-2 gap-3` + campo de data dentro de tela que usa `FilterAside`:

- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx` — o relatado (`filterBody`).
- `apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:445` e `:463` — dois pares ("De/Até" de
  abertura e de fechamento).
- `apps/web/src/pages/financeiro/NotasFiscaisPage.tsx:543` — um par.

`ComandasPage`, `TransacoesPage`, `PromocoesPage` e `ComprasPage` também usam `FilterAside` com
data, mas **não** empregam esse par lado a lado — ficam de fora.

## Arquivos tocados

- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx`
- `apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx`
- `apps/web/src/pages/financeiro/NotasFiscaisPage.tsx`
