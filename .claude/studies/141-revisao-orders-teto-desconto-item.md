# 141 — Revisão adversarial do estudo 140: o teto do desconto do ITEM recusa a cortesia de 100% em item com quantidade fracionada

Revisão da área "backend de comandas — os dois críticos de dinheiro" (estudo 140,
achados 1 a 5 do laudo 139). Os cinco achados foram reconferidos; quatro passam.
Este documento cobre o único defeito NOVO que a correção introduziu, e é o único
arquivo que vou tocar.

## Arquivos que vou tocar

- `apps/api/src/modules/orders/orders.service.ts` — método `assertDescontoDoItem`
  (linhas 481-508), criado pelo estudo 140.
- `apps/api/src/modules/usecase-tests/orders-comissao-desconto.usecases.test.ts`
  — acrescentar a verificação da cortesia de 100% em quantidade fracionada.

## Arquivos que li para conferir (NÃO vou tocar)

- `apps/api/src/modules/orders/orders.service.ts:219-252` (`create`),
  `:414-445` (`addItem`), `:509-569` (`assertEstoqueParaVenda`), `:575-638`
  (`updateItem`), `:1396-1436` (`ratearDescontoDaComanda`), `:1490-1623`
  (`generateCommissionEntries`), `:1827-1900` (`resolveCommissionPercent`),
  `:1983-2150` (`reverseFinishReconciliation`), `:2296-2383` (`recalculate`).
- `apps/web/src/components/ItemEditDrawer.tsx:131-163` — é a ÚNICA superfície do
  painel que faz PATCH `/orders/:id/items/:itemId` (`useUpdateOrderItem`,
  queries.ts:499) e ela sempre manda `discount` no corpo.
- `packages/db/prisma/schema.prisma:1303-1326` — `OrderItem.quantity` é
  `Decimal(12,3)` e `unitPrice`/`grossValue`/`discount` são `Decimal(12,2)`.
- `apps/api/src/modules/orders/orders.controller.ts:60` — `addItem` só é chamado
  pelo controller; não há outro consumidor no backend.

## O defeito

`assertDescontoDoItem` (orders.service.ts:495-507) compara o desconto com o bruto
EXATO (`unitPrice.mul(quantity)`), que pode ter até 5 casas decimais porque
`quantity` é `Decimal(12,3)`. O banco, porém, grava `grossValue` em
`Decimal(12,2)` — ou seja, o item que vai existir vale o bruto ARREDONDADO.

Reproduzido em node com o Decimal do Prisma:

```
produto R$ 3,25 · quantidade 1,5
  bruto exato ....... 4,875
  bruto gravado ..... 4,88   (Decimal(12,2))
  ItemEditDrawer com "Desconto em %" = 100 manda ... 4,88
  assertDescontoDoItem: 4,88 > 4,875 → 400
  mensagem: "Desconto de R$ 4,88 maior que o valor do item (R$ 4,88)."
```

Outros pares que caem no mesmo buraco: 1,05 × 1,5; 12,15 × 1,5; 1,05 × 2,5.

Duas consequências:

1. **Caminho que funcionava para de funcionar.** Cortesia/brinde de 100% num item
   com quantidade fracionada (produto vendido por peso/fração, meia diária de
   serviço) passava antes e agora toma 400. O mesmo vale para quem digita em
   "Desconto em R$" o total que a própria tela mostra.
2. **A mensagem é autocontraditória** — imprime os dois lados com `toFixed(2)`,
   então diz que R$ 4,88 é maior que R$ 4,88. O operador não tem o que corrigir.

O teto em si está certo e é o achado 2 do laudo; o que está errado é comparar com
uma precisão que o banco não guarda. `addDiscount` (o teto do desconto DA COMANDA,
`:801-815`, que este método espelha) não sofre do mesmo problema porque compara
com `grossTotal`, que já vem do banco em 2 casas.

## Correção

Quantizar o bruto em 2 casas antes de comparar e usar esse mesmo número na
mensagem — é exatamente o valor que o `orderItem.create/update` vai persistir.
Uma linha; não afeta o caso do laudo (200 de desconto num item de 100 continua
recusado).

## Teste

Novo caso em `orders-comissao-desconto.usecases.test.ts`: `updateItem` com
`unitPrice` 3,25, `quantity` 1,5 e `discount` 4,88 tem de PASSAR. Falha com o
código de hoje (400 "maior que o valor do item").
