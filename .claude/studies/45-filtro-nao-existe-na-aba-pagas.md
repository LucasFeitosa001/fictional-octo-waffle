# Estudo 45 — Na aba "Pagas" o painel de filtros não existe

Relato do dono: *"no web, quando clico no filtro de Pagas não funciona; já abri em aba anônima e
nada"*. A aba anônima é a informação que importa — descarta cache e aponta para o código.

## O que acontece

`apps/web/src/pages/comissoes/ComissoesResumoPage.tsx` tem três ramos de renderização:

- `:757` — `{isDetalhadas ? (` … a view de Detalhadas
- `:770` — `) : isPaidTab ? (` … a aba **Pagas**
- `:866` — `) : (` … **Resumidas**

O `<FilterAside>` é montado em **`:869`**, ou seja, DENTRO do último ramo. Na aba Pagas ele
simplesmente não está na árvore.

A barra de período (`:695`-`:702`) chama `openFilters()` (`:149`), que faz `setFilterOpen(true)`.
Na Pagas isso liga um estado que nenhum componente lê no desktop — clique sem efeito visível.

No celular funciona por acidente: o bottom-sheet (`:983`) é renderizado FORA dos três ramos, então
ele abre em qualquer aba.

## Por que passou despercebido

O painel foi escrito junto com a Resumidas e nunca saiu de lá. As duas abas mostram o mesmo tipo de
recorte (período + profissional), e a Pagas ainda tem um segundo conjunto de filtros embutido no
bloco "Pagamentos realizados" (`:826`-`:850`: `DateRangeFilter` + `Select` de profissional) — o que
mascarava a falta: existe filtro na tela, só não onde o clique manda.

Isso também explica um detalhe do desenho: com o painel valendo para as duas abas, os filtros
duplicados dentro de "Pagamentos realizados" passam a ser redundantes.

## Correção

Tirar o `FilterAside` de dentro do ramo e montá-lo para Pagas e Resumidas (Detalhadas tem a própria
coluna de filtros, `ComissoesDetalhadasView.tsx`). Estrutura: um contêiner `md:flex` comum,
com o painel à esquerda e o conteúdo da aba à direita.

## Arquivos tocados

- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx`
