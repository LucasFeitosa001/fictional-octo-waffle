# Estudo 36 — O relatório de Clientes não gera nada

Relato do dono: *"essa parte inteira não funciona, o correto seria eu escolher um período de data e
ele não faz isso e nem gera relatório"*. Tela: Relatórios → Clientes
(`apps/web/src/App.tsx:400` → `apps/web/src/pages/relatorios/ClientesPage.tsx`).

## Por que não funciona

A página é uma **casca**. Quatro defeitos somados:

1. **A fonte de dados está errada.** `apps/web/src/pages/relatorios/ClientesPage.tsx:152` faz
   `useReportsOverview(range.from, range.to)` e lê `query.data?.newCustomers` (`:153`). Isso é a
   lista de **clientes NOVOS no período** do dashboard — não "a lista completa de clientes", que é
   o que o subtítulo da própria tela promete.

2. **O botão fica morto.** `apps/web/src/pages/relatorios/ClientesPage.tsx:262` tem
   `disabled={customers.length === 0}`. Como a fonte só traz clientes criados no período, um salão
   que não cadastrou ninguém nesses dias vê o botão desabilitado e conclui, com razão, que "não
   gera relatório".

3. **Os filtros não filtram.** `balance` (`:145`) e `status` (`:146`) são estado que **ninguém lê** —
   um `grep` por `balance`/`status` no resto do arquivo só encontra os `Segmented` que os escrevem.
   Hashtags é explicitamente um placeholder (`:234`, comentário "TODO: sem endpoint de hashtags").

4. **14 das 18 colunas são TODO.** Em `COLUMN_DEFS` só `phone`, `email`, `createdAt` e o nome têm
   `get`; CPF, RG, aniversário, endereço, bairro, cidade, estado, crédito, hashtags, quantidade e
   valor de pacotes e de comandas estão todos marcados `// TODO`. Marcar essas colunas hoje produz
   uma coluna vazia no CSV.

## O que existe para apoiar

- `GET /customers` (`apps/api/src/modules/customers/customers.service.ts:24`) já filtra por `active`
  e `hasDebt`, mas **não** por intervalo de criação, e é paginado — não serve para um relatório.
- O módulo de relatórios já tem o formato certo de endpoint: `apps/api/src/modules/reports/reports.controller.ts:79`
  (`birthdays`) e `:88` (`sales`), com `@RequirePermission` e `@Query('from'/'to')`, servidos por
  `apps/api/src/modules/reports/reports.service.ts:632` em diante.
- O CSV já é gerado no cliente por `downloadCsv`, que a página importa.

## Correção

**Novo endpoint `GET /reports/customers`**, no mesmo formato dos outros:

`from`, `to` (intervalo de **criação**), `status` (all|active|inactive), `balance` (all|with_balance),
`tags` (lista por vírgula).

Devolve, por cliente, tudo que as colunas pedem — inclusive as que hoje são TODO:
nome, telefone, e-mail, CPF, RG, aniversário, endereço/número/bairro/cidade/estado, saldo de
crédito, data de criação, hashtags, e as contagens e somas de pacotes e comandas.

Contagens e somas saem de `_count`/agregação no próprio `findMany` — não de N+1 por cliente.

No front: trocar a fonte, aplicar os três filtros de verdade, habilitar o botão sempre que houver
linha, e preencher os `get` que faltam.

## Arquivos tocados

- `apps/api/src/modules/reports/reports.controller.ts`
- `apps/api/src/modules/reports/reports.service.ts`
- `apps/web/src/lib/queries/relatorios.ts`
- `apps/web/src/pages/relatorios/ClientesPage.tsx`
