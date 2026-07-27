# Estudo 04 — `GET /orders` sem paginação (~3,5 MB por request)

Severidade: **HIGH** (trava a tela de Comandas)

## Arquivos estudados

- `apps/api/src/modules/orders/orders.service.ts`
- `apps/web/src/lib/queries.ts`
- `apps/web/src/pages/ComandasPage.tsx`

## O que o código faz HOJE (evidências)

`apps/api/src/modules/orders/orders.service.ts:24` — `list(companyId, status?)`:
- `:26` `findMany` **sem `take`/`skip`** → devolve TODAS as comandas da empresa (3206 na Fátima)
- `:28` `include: { customer: true }` → objeto `Customer` **inteiro** por comanda
  (o model tem **55 colunas** — `packages/db/prisma/schema.prisma`, model `Customer`)
- `:37` devolve um envelope de paginação **falso**: `page: 1, pageSize: data.length, total: data.length`

Front:
- `apps/web/src/lib/queries.ts:234` `useOrders(status?)` → `GET /orders`
- `apps/web/src/pages/ComandasPage.tsx:357` é o **único** consumidor
- `apps/web/src/pages/ComandasPage.tsx:359` `allRows` = lista completa
- `apps/web/src/pages/ComandasPage.tsx:403`–`:409` filtro/busca **no cliente**
- `apps/web/src/pages/ComandasPage.tsx:268`/`:374` paginação **no cliente** (`pageWindow`, estado `page`)

## Fato que define a correção

A lista usa do cliente **apenas `id` e `name`**:
`grep` em `apps/web/src/pages/ComandasPage.tsx` retorna só `o.customer?.id` e `o.customer?.name`
(nenhum `phone`/`email`/`avatarUrl`/etc.). Os dados ricos do cliente vêm do **detalhe**
(`findOne` em `apps/api/src/modules/orders/orders.service.ts:104`, com include próprio), que é outra query.

## Decisão — em duas etapas

**Etapa 1 (feita agora, risco ~zero):** trocar `include: { customer: true }` por
`select: { id, name }` no `customer` da LISTA. Corta a maior parte do payload sem mudar
comportamento nenhum: filtros, busca e paginação client-side continuam funcionando porque
todas as linhas continuam sendo entregues.

**Etapa 2 (pendente, mudança de arquitetura):** paginação de verdade no servidor
(`take`/`skip` + `count`) com os filtros migrados para query params (status, cliente, forma
de pagamento, intervalo de datas, busca). Isso **exige reescrever** `ComandasPage`
(`:268`, `:357`, `:374`, `:403`), porque hoje ela depende de ter a base inteira em memória.
Não dá para paginar no servidor sem mover o filtro junto — senão a tela filtra só a página atual
e o usuário passa a "perder" resultados, que é pior que a lentidão.

Registrado como próximo item, não improvisado agora.
