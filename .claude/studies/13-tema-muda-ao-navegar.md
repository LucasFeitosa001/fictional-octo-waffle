# Estudo 13 — Tema volta ao da empresa a cada navegação

Sintoma relatado (27/07): "estava com filtro verde e fui na página de serviço e mudou para o cinza".

## Não é a página de Serviços

`grep` por `applyTheme(` / `setTheme(` / `dataset.theme` em `apps/web/src/pages` e
`apps/web/src/components`: **nenhuma página mexe no tema**. `ServicosPage` só usa
`var(--sp-primary)` e `color-mix` (`apps/web/src/pages/ServicosPage.tsx:53`–`:55`), que é o jeito
correto e themeable.

## Causa real: o shell REMONTA a cada navegação

`apps/web/src/App.tsx:521`:

```tsx
<RouteErrorBoundary key={location.pathname}>
```

A `key` muda a cada rota → o React **desmonta e remonta toda a árvore** abaixo, incluindo o
`DashboardLayout` (`apps/web/src/App.tsx:291`), que é onde vive o `useThemeSync`
(`apps/web/src/layout/DashboardLayout.tsx:19`).

Remontar zera os `useRef` do hook — inclusive o `syncedFor`, que existe justamente para o sync rodar
**uma vez por empresa**. Resultado: **toda navegação** refaz o GET `/companies/current/appearance` e
reaplica o tema da empresa por cima do que o usuário escolheu na sessão.

É a mesma família do bug "tudo virou azul" de mais cedo: o visual local sendo sobrescrito por um
re-sync que não deveria acontecer.

## Por que "verde → cinza"

O usuário escolheu esmeralda (verde) na sessão; ao navegar, o sync reaplicou o que está salvo na
empresa (ou o padrão). Como a escolha só persiste na empresa quando quem escolhe tem `config:manage`
E o POST conclui, qualquer falha ali deixa o local divergente do servidor — e a próxima navegação
"puxa de volta".

## Decisão

O `key={location.pathname}` existe para o error boundary resetar ao trocar de rota (senão uma tela
que quebrou continuaria quebrada ao navegar). Remover a key inteira traria de volta esse problema.

Correção: **mover o reset para o próprio boundary** — em vez de remontar a árvore inteira via `key`,
o `RouteErrorBoundary` observa a mudança de rota e limpa só o seu `hasError`. Assim o boundary
continua se recuperando entre rotas, e o shell (com o `useThemeSync`, e qualquer outro estado de
sessão) para de ser destruído a cada clique no menu.

Ganho colateral: para de refazer requisições e remontar a UI inteira a cada navegação — reduz
piscadas e trabalho desperdiçado em todas as telas, não só no tema.
