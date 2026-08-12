# Estudo 25 — "Movimentar estoque" some atrás do drawer de produto

Achado pelo verificador adversarial do workflow `sweep-drawers-meia-tela`, depois que
`apps/web/src/pages/ProdutosPage.tsx:1419` virou tela cheia (widthClass removido).

## O defeito

O botão "Movimentar estoque" fica **dentro** do drawer de produto
(`apps/web/src/pages/ProdutosPage.tsx:1549`-`:1553`) e o handler de
`apps/web/src/pages/ProdutosPage.tsx:1048` **não fecha** o estado `editing`. Resultado: o
`StockMovementDrawer` (`apps/web/src/pages/ProdutosPage.tsx:1832`) abre com o drawer de produto
ainda montado por baixo.

Aí bate a diferença de camada:

- `StockMovementDrawer` é um `<Drawer>` **sem `zClass`** → default `z-[70]`
  (`apps/web/src/components/Drawer.tsx:54`)
- o drawer de produto é um `FullDrawer`, que portala em `z-[80]`
  (`apps/web/src/components/FullDrawer.tsx:176`), com backdrop opaco em
  `apps/web/src/components/FullDrawer.tsx:178`-`:183`

Já estava errado antes (o backdrop z-80 também cobria), mas o painel era uma faixa de 600px, então
sobrava tela e o usuário via alguma coisa. Agora o painel é `inset-0 h-dvh`: o clique em "Movimentar
estoque" passa a **não ter nenhum efeito visível**, e ainda trava o scroll do body.

## A convenção que o repositório já usa

`apps/web/src/components/Drawer.tsx:20`-`:22` documenta `zClass` exatamente para sub-drawer. Quem
abre por cima de outro drawer já usa `z-[90]`:

- `apps/web/src/components/CustomerPickerDrawer.tsx:95`
- `apps/web/src/components/ItemPickerDrawer.tsx:134`
- `apps/web/src/components/ItemEditDrawer.tsx:174`
- `apps/web/src/components/ComandaDrawer.tsx:889`

## Correção

`zClass="z-[90]"` no `<Drawer>` de `apps/web/src/pages/ProdutosPage.tsx:1832`.

## Ruído a limpar no mesmo arquivo

`apps/web/src/pages/ProdutosPage.tsx:2238` mantém `widthClass="sm:w-[600px]"` num `<Drawer>` que já
tem `fullscreen` em `:2239` — inerte no desktop por `apps/web/src/components/Drawer.tsx:147`. O
problema é que no MESMO arquivo convivem dois `FullDrawer`, onde `widthClass` tem o efeito
**oposto**. Quem mexer depois pode concluir que a prop "não faz nada" e reintroduzi-la num
FullDrawer. Remover a linha morta.

## Comentário mentiroso

`apps/web/src/components/FullDrawer.tsx:185` diz "desktop: right-slide (translate-x, 1200px)". Não
existe 1200px no componente, e o caminho padrão (sem widthClass) nem é lateral — é `inset-0`.
Pré-existente; corrigir de passagem.
