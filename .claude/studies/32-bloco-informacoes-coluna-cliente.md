# Estudo 32 — Bloco "Informações" na coluna do cliente

Pedido do dono, repetido três vezes: *"falta essa parte de informação"*. Referência forte:
`belasis-reference/_spec-paridade/01-visualizando-comanda.png` e `04-visualizando-agendamento.png`,
ambas mandadas por ele com "quero esses locais idênticos".

## O que o Belasis mostra

Logo abaixo do card do cliente, um bloco **Informações** com 5 linhas, cada uma com ícone à
esquerda e texto em azul-link:

1. `Aniversário em 11, julho` — ou `Aniversário não definido` quando não há data
2. `R$ 0,00 em cashback`
3. `R$ 0,00 em crédito`
4. `0 comandas em aberto`
5. `0 pagamentos em aberto`

## O que temos

**Nada.** `grep -rn "em cashback|em crédito|comandas em aberto|pagamentos em aberto|Aniversário"` em
`apps/web/src/components/ComandaDrawer.tsx`, `apps/web/src/pages/AgendaPage.tsx` e
`apps/web/src/components/ClienteBlocosLaterais.tsx` não retorna nenhuma linha.

O componente compartilhado `apps/web/src/components/ClienteBlocosLaterais.tsx:35` só conhece
`'pacotes' | 'assinaturas' | 'anotacoes'`.

## Os dados: 3 dos 5 já existem num único endpoint

`GET /customers/:id/panel` (`apps/api/src/modules/customers/customers.controller.ts:70` →
`apps/api/src/modules/customers/customers.service.ts:197`) devolve, em
`apps/api/src/modules/customers/customers.service.ts:295`-`:305`:

| Linha do bloco | Campo do panel |
|---|---|
| Aniversário | `customer.birthday` (`CustomerFull`, `apps/web/src/lib/types.ts:40`) |
| cashback | `cashbackSaldo` |
| crédito | `creditosSaldo` |
| comandas em aberto | **não existe** |
| pagamentos em aberto | **não existe** (`debitosTotal` é SOMA, não contagem) |

Hook pronto: `useCustomerPanel` em `apps/web/src/lib/queries/clientes.ts:224`. Tipo `CustomerPanel`
em `apps/web/src/lib/types.ts:78`-`:88`.

## Decisão: acrescentar as duas contagens ao panel, não somar hooks

O caminho preguiçoso seria chamar também `useCustomerOrders` e `useCustomerDebts` no componente e
contar no cliente. Seriam **3 requisições por drawer**, em cima de `packages` e `notes` que a coluna
já faz — 5 no total, toda vez que alguém abre uma comanda. E `useCustomerOrders`
(`apps/web/src/lib/queries/clientes.ts:339` → `customers.service.ts:510`) traz até 100 comandas
inteiras só para contar quantas estão abertas.

Melhor: dois `count` no `Promise.all` que o panel **já faz**
(`apps/api/src/modules/customers/customers.service.ts:200`-`:208`), devolvidos como
`comandasEmAberto` e `pagamentosEmAberto`. Uma requisição, e o custo é de duas contagens indexadas.

- comandas em aberto → `order.count({ companyId, customerId, status: 'open' })`
  (`OrderStatus.open` é `'open'`, `packages/shared/src/enums.ts`)
- pagamentos em aberto → `customerDebt.count({ companyId, customerId, status: 'open' })`
  — o mesmo recorte que `debitosAbertos` já usa em `customers.service.ts:216`-`:219`, só que
  contando em vez de trazer as linhas

## Onde o bloco entra

`ClienteBlocosLaterais` ganha o id `'informacoes'` e passa a ser o **primeiro** da ordem padrão
(no vídeo ele vem antes de Pacotes). Como as três superfícies já usam o componente
(`ComandaDrawer.tsx`, `AgendaPage.tsx`, `PacoteClienteAside.tsx`), o bloco aparece nas três de uma
vez — que é o ponto de o componente existir.

O bloco **não tem** "+ Adicionar" em nenhum quadro.

## Arquivos tocados

- `apps/api/src/modules/customers/customers.service.ts`
- `apps/web/src/lib/types.ts`
- `apps/web/src/components/ClienteBlocosLaterais.tsx`
