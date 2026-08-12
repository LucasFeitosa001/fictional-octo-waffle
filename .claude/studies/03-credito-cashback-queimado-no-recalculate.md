# Estudo 03 — Crédito/cashback do cliente é QUEIMADO quando o total da comanda cai

Severidade: **HIGH** (o cliente perde saldo real, sem aviso)

## Arquivo estudado

- `apps/api/src/modules/orders/orders.service.ts`

## O que o código faz HOJE (evidências)

`apps/api/src/modules/orders/orders.service.ts:1499` — `recalculate(id)`:

- `:1504` `gross` = soma de `grossValue - discount` dos itens
- `:1508`–`:1514` `discountTotal` = descontos da comanda (percent ou valor)
- `:1515` `net = gross - discountTotal - creditUsed - cashbackUsed`
- `:1521` **`netTotal: net < 0 ? 0 : net`** ← trava em zero, mas **NÃO mexe em `creditUsed`/`cashbackUsed`**

Ou seja: se o valor a pagar cair abaixo do que já foi abatido, o excedente some. O `netTotal` fica 0,
`creditUsed` continua alto, e o débito no ledger do cliente já aconteceu.

## Como o ledger funciona (o que precisa ser reescrito junto)

Crédito — `apps/api/src/modules/orders/orders.service.ts:564` `applyCredit`:
- `:575` apaga a aplicação anterior desta comanda: `customerCredit.deleteMany({ customerId, reason: 'order:<id>' })`
- `:576`–`:582` valida saldo disponível (soma de `CustomerCredit.amount`)
- `:583` cria a linha de débito: `amount: amount.negated(), reason: 'order:<id>'`
- `:586` grava `order.creditUsed`

Cashback — `applyCashback` (`:605`): mesma mecânica em `CustomerCashback`, chaveada por
`sourceType: 'order', sourceId: <id>` (deleteMany em `:616`, create em `:632`, `cashbackUsed` em `:640`).

`removeCredit` (`:593`) e `removeCashback` (`:646`) apagam a linha e zeram o campo.

## Quem chama `recalculate`

`:295`, `:370`, `:380`, `:590`, `:602`, `:643`, `:655`, `:666`, `:772` — ou seja: adicionar/editar/remover
item, aplicar/remover crédito e cashback, aplicar desconto e o próprio `finish`. Qualquer um desses pode
derrubar o total abaixo do já abatido.

## Decisão

Em `recalculate`, calcular `base = gross - discountTotal` e, quando `creditUsed + cashbackUsed > base`,
**reduzir proporcionalmente** os dois e **reescrever as linhas do ledger** (`CustomerCredit.reason='order:<id>'`
e `CustomerCashback.sourceType='order'/sourceId=<id>`) para o novo valor, na MESMA transação em que o
`Order` é atualizado. O que sobra volta a ser saldo do cliente automaticamente, porque o saldo é a soma
das linhas do ledger.

Proporcional (e não "corta o crédito primeiro") para não escolher arbitrariamente de qual bolso o cliente
perde prioridade; e a soma final é exatamente `base`, então `netTotal` fica 0 sem excedente queimado.

Cuidado de implementação: `recalculate` hoje faz um `order.update` solto. Passa a precisar de transação,
pois agora escreve em três tabelas (Order + CustomerCredit + CustomerCashback) e não pode ficar pela metade.
