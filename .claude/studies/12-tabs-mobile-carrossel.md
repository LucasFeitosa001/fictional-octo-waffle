# Estudo 12 — Tabs quebrados no mobile (todos, sem exceção)

Pedido do dono (27/07): os tabs no mobile estão horríveis em todas as telas; devem virar
**carrossel horizontal** com rolagem fluida (arrastar com o dedo).

## Diagnóstico

`grep` em `apps/web/src`: **30 arquivos** implementam tabs e **não existe componente compartilhado**
(`ls apps/web/src/components | grep -i '^tab'` → nada). Cada página reescreve o seu.

Exemplo do padrão local — `apps/web/src/pages/financeiro/CaixasAbertosPage.tsx:172` `function Tab(...)`:
o container é `flex items-center gap-6 border-b border-line` (`:120`) e cada item
`-mb-px border-b-2 px-1 pb-2.5 pt-1 text-sm` (`:186`).

**Por que quebra no mobile:** o container é `flex` sem `overflow-x`, então com 4+ abas os itens
espremem, quebram linha ou vazam para fora da viewport — e não há como arrastar. Como o padrão foi
copiado entre as telas, o mesmo defeito aparece em todas.

Outras variantes encontradas: `inline-flex ... rounded-lg border ... p-0.5` (pílulas, ex.
`ComandasPage`, `ComandaDrawer`) e `role="tablist"` do HeroUI. Mesma causa: sem rolagem horizontal.

## Decisão

Criar **`apps/web/src/components/Tabs.tsx`** com as duas variantes visuais que já existem
(`underline` e `pill`) e o comportamento de carrossel no mobile:

- `overflow-x-auto` + `flex-nowrap` → arrasta com o dedo
- `snap-x snap-mandatory` + `snap-start` nos itens → para alinhado, sem meio-item cortado
- `scrollbar-none` (utilitário próprio) → sem barra feia no mobile
- `scroll-mt`/`scrollIntoView` da aba ativa ao montar → a aba selecionada nunca nasce fora da tela
- `overscroll-x-contain` → arrastar a aba não puxa a página inteira
- `-mx-3 px-3` no mobile → o carrossel sangra até a borda (padrão de lista mobile do projeto),
  respeitando o padding lateral do DashboardLayout

Depois, migrar as 30 telas para o componente. A migração é mecânica, mas é onde mora o risco:
cada tela tem rótulos/estado próprios. Fazer em lotes, com typecheck a cada lote.

Regra do projeto a respeitar: o padding lateral do mobile vem SÓ do DashboardLayout (px-3) — o
carrossel usa margem negativa para sangrar, sem introduzir padding novo.
