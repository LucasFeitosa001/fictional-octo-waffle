# Estudo 06 — Re-faturar dá 500 permanente (E) e totais inconsistentes no create (I)

## E — `legacyId` sobrevive ao estorno feito pelo Financeiro → P2002 (500) para sempre

Arquivos: `apps/api/src/modules/financial/financial.service.ts`, `apps/api/src/modules/orders/orders.service.ts`

- Ao faturar, cada pagamento gera uma `Transaction` com
  `legacyId = order:{orderId}:pay:{paymentId}` — `apps/api/src/modules/orders/orders.service.ts:978`.
  A unicidade é garantida por `@@unique([companyId, legacyId])` (`:939`–`:940`).
- A busca de idempotência ignora estornadas:
  `apps/api/src/modules/orders/orders.service.ts:984` → `where: { companyId, legacyId, status: { not: 'reversed' } }`.
  O comentário em `:981` diz que reopen/cancel **zeram** o legacyId (isso acontece em
  `reverseFinishReconciliation`).
- Mas o estorno feito pela tela de **Financeiro** NÃO zera:
  `apps/api/src/modules/financial/financial.service.ts:562`–`:568` faz `update` com
  `status: 'reversed'`, `reversedAt`, `reversedByUserId` — e **mantém o `legacyId`**.

Resultado: estornar a receita no Financeiro → reabrir → faturar de novo → o find não acha (está `reversed`),
o create tenta gravar o mesmo `legacyId` → **P2002 → 500**, e a comanda fica impossível de faturar.

**Correção:** acrescentar `legacyId: null` no update do estorno do Financeiro — exatamente o que
`reverseFinishReconciliation` já faz no outro caminho. O vínculo com a comanda continua por `orderId`
e `reversalOfId`, então nada de rastreabilidade se perde.

## I — `create()` e `recalculate()` usam definições DIFERENTES de bruto/desconto

Arquivo: `apps/api/src/modules/orders/orders.service.ts`

- `create()` (`:195`–`:206`): `grossTotal = Σ grossValue` e `discountTotal = Σ desconto DO ITEM`.
- `recalculate()` (`:1504`–`:1514`): `gross = Σ (grossValue − desconto do item)` e
  `discountTotal = Σ descontos DA COMANDA` (`order.discounts`).

O `netTotal` bate nos dois, mas os campos exibidos não: assim que qualquer coisa dispara um
`recalculate` (adicionar item, desconto, crédito…), "Total bruto" e "Descontos" da mesma comanda **mudam de
significado** na tela, sem nada ter sido alterado pelo usuário.

**Correção:** `create()` passa a usar a definição do `recalculate` (a canônica, usada em todo o resto do
ciclo de vida). Na criação não existe `OrderDiscount`, então `discountTotal` nasce 0 e o desconto de item
já entra abatido no bruto.
