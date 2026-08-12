# Estudo 54 — Perfil do cliente: a mesma visita aparece duas vezes, e cancelado conta como visita

Relato do dono: *"PARTE DOS CLIENTES TÁ BUGADA TAMBÉM, PQ NÃO MOSTRA AGENDAMENTOS E COMANDAS QUE AS
PESSOAS TIVERAM DE UMA FORMA CORRETA, VERIFIQUE SE ESTÁ BATENDO MESMO"*.

Tudo abaixo está em `apps/api/src/modules/customers/customers.service.ts`, no `panel()`.

## 54.1 — A mesma visita entra duas vezes

`:286`-`:309` monta `ultimosServicos` concatenando os itens dos AGENDAMENTOS com os itens das
COMANDAS, sem cruzar um com o outro:

```ts
const ultimosServicos = [
  ...appointments.flatMap((a) => a.items.map(...)),   // source: 'appointment'
  ...orders.flatMap((o) => o.items.map(...)),         // source: 'order'
].sort(...).slice(0, 10);
```

Quando o atendimento agendado vira comanda — que é o fluxo normal do salão — a visita aparece
duas vezes na lista. Na cópia do banco de produção há **1283 pares agendamento+comanda do mesmo
cliente no mesmo dia**.

Agora dá para cruzar com precisão: `Order.appointmentId` passou a existir (estudo 52). Para o
histórico antigo, que não tem o vínculo, sobra o par (mesmo dia + mesmo nome de item).

## 54.2 — Agendamento FUTURO entra em "últimos serviços" e zera o "dias sem vir"

`:257`-`:262` busca os agendamentos por `orderBy: { start: 'desc' }, take: 10` **sem recorte de
data**. O que está marcado para semana que vem entra na lista de serviços JÁ FEITOS e empurra o
histórico real para fora dos dez.

Pior em `:273`-`:282`: `lastVisitAt` é o `Math.max` dessas mesmas datas, então um agendamento
futuro faz `diasSemVir` ficar **negativo** — "cliente sem vir há −6 dias".

## 54.3 — Cancelado conta como visita

Nenhuma das duas consultas (`:258` e `:264`) exclui `status: 'canceled'`. Agendamento desmarcado e
comanda cancelada entram em `ultimosServicos` com o preço cheio e contam como última visita.

E o front não mostra o status do item: `apps/web/src/pages/ClientePerfilTabs.tsx:925`-`:951`
renderiza data, nome e preço — `s.status` vem no payload (`PanelServiceItem`) e não é usado. Um
serviço cancelado fica idêntico a um realizado.

## 54.4 — Item de comanda sem nome

`:302`: `name: null as string | null`. O item da comanda guarda `kind` + `refId`, e ninguém
resolve o nome do serviço/produto. O front cai no genérico e o histórico vira
"Serviço · Serviço · Produto" (`ClientePerfilTabs.tsx:930`-`:937`).

## 54.5 — Limites que ninguém vê

- `:309` — `.slice(0, 10)` corta por ITEM: uma comanda com dez itens ocupa a lista inteira.
- `:526` e `:540` — as abas Agendamentos e Vendas trazem `take: 100` sem paginação e sem total; o
  front pede uma vez só (`apps/web/src/lib/queries/clientes.ts:330`-`:345`). O maior cliente da
  base tem **99 comandas** — está a uma de truncar em silêncio.

## O que está certo (auditado, não mexer)

- Escopo multi-tenant: todas as consultas filtram `companyId` + `customerId` (`:214`, `:218`,
  `:240`, `:248`, `:253`, `:258`, `:264`, `:523`, `:538`). Zero linhas divergentes na base.
- `Customer.deletedAt` respeitado via `findOne` (`:79`-`:84`).
- Campos de data corretos: comanda por `date`, agendamento por `start`.

## Correção

1. Agendamentos do painel: só passados (`start <= agora`) e não cancelados.
2. Comandas do painel: não canceladas.
3. Dedup da visita: descarta o item de agendamento quando existe comanda ligada
   (`Order.appointmentId`) ou comanda do MESMO dia com o MESMO nome de item.
4. Resolve o nome dos itens de comanda (Service/Product por `refId`, em duas consultas em lote).
5. `lastVisitAt`/`diasSemVir` passam a usar o mesmo conjunto limpo — nunca negativo.
6. O front passa a marcar item cancelado (o dado já vinha).

O `take: 100` das abas fica registrado aqui, sem mexer: exige paginação no front e ainda não
trunca ninguém (máximo real = 99).

## Arquivos tocados

- `apps/api/src/modules/customers/customers.service.ts`
- `apps/web/src/pages/ClientePerfilTabs.tsx`
