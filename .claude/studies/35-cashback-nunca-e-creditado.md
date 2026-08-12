# Estudo 35 — O programa de cashback nunca credita nada

Pedido do dono: *"essa parte do cashback veja a melhor maneira de criar ela, pesquisa e integra ela
veja como ela é criada em outros locais"*.

## O achado

O cashback está **inteiro, menos a parte que importa**. Existe configuração, existem regras, existe
resgate, existe ajuste manual — e **nenhum código credita o cliente quando ele compra**.

Prova: `grep -rn "customerCashback.create" apps/api/src` devolve 4 pontos, e nenhum é ganho por venda:

| Ponto | O que faz |
|---|---|
| `apps/api/src/modules/orders/orders.service.ts:676` | **débito** ao usar cashback na comanda (`applyCashback`) |
| `apps/api/src/modules/orders/orders.service.ts:1627` | estorno do débito ao cancelar |
| `apps/api/src/modules/customers/customers.service.ts:483` e `:499` | ajuste **manual** pelo admin |

E `grep -n "async finish" -A 60 … | grep cashback` não retorna nada: `finish()`
(`apps/api/src/modules/orders/orders.service.ts:818`) gera transação financeira, movimento de caixa,
comissão e baixa de estoque — **cashback não**.

Consequência prática: o salão liga o programa, promete 5% ao cliente, e o saldo fica eternamente
zero. As três configurações abaixo são decorativas hoje:

- `Company.cashbackActive / cashbackValueType / cashbackValue / cashbackMinimum / cashbackCanRedeem`
  (`packages/db/prisma/schema.prisma:226`-`:230`)
- `CashbackRule` com `scopeType`, `scopeId`, `percent` e `validityDays`
  (`packages/db/prisma/schema.prisma:2006`) — só tem CRUD em
  `apps/api/src/modules/marketing/marketing.service.ts:562`-`:603`, nenhum consumo
- `Service.cashbackPercent` (`:940`) e `Product.cashbackActive/cashbackType/cashbackValue`
  (`:1033`-`:1035`) — só aparecem em seed e importador

## Segundo defeito: o saldo exibido não é o saldo usável

`apps/api/src/modules/customers/customers.service.ts:227` soma **todas** as linhas:
```ts
this.prisma.client.customerCashback.aggregate({
  _sum: { amount: true },
  where: { customerId: id, customer: { companyId } },
})
```
Mas o resgate (`apps/api/src/modules/orders/orders.service.ts:663`-`:670`) exclui as vencidas:
```ts
OR: [{ expiresAt: null }, { expiresAt: { gte: now } }]
```
Os dois discordam: o cliente vê saldo que o sistema recusa na hora de usar, com "Saldo de cashback
insuficiente".

Há ainda um caso de borda que produz **saldo negativo**: se um lote de +10 vence mas o débito de −5
continua (débito não tem validade), a soma das não-vencidas dá −5.

## O que a pesquisa externa confirma

O padrão recomendado para programa de fidelidade é: **ledger** com uma linha por evento (nunca um
campo de saldo mutável), **lotes com validade própria** por evento de ganho, e **consumo FIFO** do
lote mais antigo. Fonte: [Ledgers for Reward and Loyalty
Programs](https://global.docs.decentro.tech/docs/ledgers-for-reward-and-loyalty-programs) e
[How to Account for Customer Loyalty
Programmes](https://www.growave.io/blog/how-to-account-for-customer-loyalty-programmes).

Ou seja: **o nosso modelo já está certo**. `CustomerCashback` é exatamente esse ledger, com
`amount` (positivo = ganho, negativo = resgate), `expiresAt` por linha e `sourceType`/`sourceId` para
rastrear a origem. Não é caso de trocar o schema — é caso de escrever o que falta.

## Como fazer, seguindo o padrão que JÁ EXISTE no repositório

O dono pediu "veja como ela é criada em outros locais". O lugar certo para olhar é o motor de
**comissão** deste mesmo arquivo: `resolveCommissionPercent`
(`apps/api/src/modules/orders/orders.service.ts:1166`) resolve o percentual por item com precedência
do mais específico para o mais genérico, casando `scopeType` service/product → category → all e
caindo no padrão do catálogo. `generateCommissionEntries` (`:1099`) roda dentro do `finish()`
(`:929`), na mesma transação.

O cashback ganha o gêmeo disso:

```
resolveCashbackPercent(tx, companyId, item)
  1. CashbackRule scopeType=service|product, scopeId = item.refId
  2. CashbackRule scopeType=category, scopeId = categoria do item
  3. CashbackRule scopeType=all
  4. Catálogo: Service.cashbackPercent | Product.cashbackActive+cashbackType+cashbackValue
  5. Padrão da empresa: Company.cashbackValueType + cashbackValue
```

`validityDays` da regra vira `expiresAt` (0 = sem validade). Regra de valor fixo vira percentual
efetivo sobre a base do item, igual ao `toPercent` da comissão (`:1199`).

Portas de entrada:
- `Company.cashbackActive === false` → não credita nada
- `netTotal < Company.cashbackMinimum` → não credita (é para isso que o campo existe)

## Cuidados que o código atual impõe

1. **`sourceType` NÃO pode ser `'order'`.** `applyCashback`
   (`apps/api/src/modules/orders/orders.service.ts:660`-`:662`) faz
   `deleteMany({ sourceType: 'order', sourceId: id })` antes de gravar o débito — se o ganho usasse o
   mesmo par, usar cashback apagaria o ganho da própria comanda. Usar `'order-earn'`.
2. **Idempotência**: `finish()` já é idempotente (`:824`), mas reabrir e refaturar não pode duplicar
   o crédito. Apagar as linhas `order-earn` daquela comanda antes de gravar.
3. **Reabrir/cancelar** tem de estornar o ganho, como já é feito com o débito em `:1627`.
4. O crédito entra **dentro da mesma transação** do `finish()`, ao lado de
   `generateCommissionEntries` (`:929`) — senão uma falha depois deixa cashback fantasma.

## Arquivos tocados

- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/modules/customers/customers.service.ts` (saldo exibido = saldo usável)
