# Estudo 53 — Despesa/Receita/Transferência/Vale voltam a ser faixa lateral; Transações ganha menu de linha

Dois pedidos do dono na mesma tela:

> *"nas tabelas, em transações, ao invés de estornar, era pra ter aquele ícone de menu, e abrir o
> dropdown com as opções"*
>
> *"NOS DRAWERS DE DESPESA, RECEITA, TRANSFERENCIA, VALE, NÃO É PRO DRAWER FICAR FULL SCREEN,
> TODOS FICARAM FULL SCREEN, QUANDO VOCÊ IMPLEMENTOU ISSO?"*

## 53.1 — Quando os drawers viraram tela cheia

Commit **`110f268`, 27/07/2026 19:16** — *"fix(web): drawers de registro abrem em tela inteira no
desktop"*. A mensagem dele explica o raciocínio da época: `Drawer` já tinha a prop `fullscreen`,
"11 drawers já a usavam — os outros ficaram para trás", e o commit passou **14 drawers de REGISTRO**
para tela cheia de uma vez. Foi uma varredura de consistência, e ela passou do ponto nestes quatro.

Estado hoje:

- `apps/web/src/components/ValeModal.tsx:76`-`:81` — `<Drawer widthClass="sm:w-[440px]" fullscreen>`
- `apps/web/src/pages/financeiro/TransacoesPage.tsx:1969`-`:1973` (Nova transferência) —
  `<Drawer widthClass="sm:w-[520px]" fullscreen>`
- `apps/web/src/pages/financeiro/TransacoesPage.tsx:1647` (Despesa/Receita) — `<FullDrawer>` **sem**
  `widthClass`

Nos dois primeiros o `widthClass` está lá e é IGNORADO: `components/Drawer.tsx:26`-`:29` documenta
que `fullscreen` "Ignora `widthClass` no desktop", e `Drawer.tsx:147` aplica `w-full`. Ou seja, os
440px e os 520px que o código pede nunca valeram desde 27/07.

No terceiro, `FullDrawer.tsx:195`-`:199`: sem `widthClass` o painel é `inset-0` (tela cheia); com
ele vira `right-0 … border-l` com a largura pedida. O comentário de `TransacoesPage.tsx:1651` ainda
justifica a tela cheia por causa do menu de seções — mas o mesmo comentário diz que as `sections`
foram removidas ("a referência é uma página só"). A premissa caiu; a tela cheia ficou.

**Correção:** tirar `fullscreen` do Vale e da Transferência (as larguras já estão escritas) e dar
`widthClass` ao drawer de Despesa/Receita. Ele tem linhas de 3 colunas, então 760px — não os 520
que motivaram a reclamação original.

## 53.2 — A linha de Transações tem dois ícones soltos, não um menu

`apps/web/src/pages/financeiro/TransacoesPage.tsx:540`-`:569`: a coluna de ações renderiza dois
`Button isIconOnly` — lápis (Editar) e seta circular (Estornar) —, e some inteira quando
`t.status === 'reversed'`.

O padrão do produto (e da referência) é o menu por linha: `pages/ComandasPage.tsx:181` tem o
`RowMenu` com hambúrguer + dropdown animado, e foi assim que o dono pediu.

As três operações existem na API — `financial.controller.ts:102` (`PATCH transactions/:id`),
`:92` (`POST transactions/:id/reverse`) e `:112` (`DELETE transactions/:id`) — e os três hooks já
estão no front (`lib/queries/financeiro.ts:323`, `:336`, `:349`). O `useDeleteTransaction` só era
usado na ação em LOTE (`TransacoesPage.tsx:293`-`:305`); por linha não havia como excluir.

O menu fica: **Editar · Estornar · Excluir**. A captura mobile do Belasis
(`belasis-reference/finance-transactions/mobile.html`) mostra exatamente `Excluir` e `Estornar`
como ações por linha, e o dicionário do bundle traz `refund_transaction: "Estornar transação"`.

No celular o cartão não tem ações (`TransacoesPage.tsx:860`-`:915`, o toque abre a edição): ganha
o mesmo "⋮" abrindo bottom-sheet, como foi feito em Comandas (estudo 49).

## Arquivos tocados

- `apps/web/src/components/ValeModal.tsx`
- `apps/web/src/pages/financeiro/TransacoesPage.tsx`
