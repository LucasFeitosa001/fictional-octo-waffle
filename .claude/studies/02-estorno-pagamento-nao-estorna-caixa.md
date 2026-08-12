# Estudo 02 — Estornar pagamento de comanda FINALIZADA não estorna Caixa/Financeiro/Comissão

Severidade: **HIGH** (dinheiro fantasma no caixa)

## Arquivos estudados

- `apps/api/src/modules/orders/orders.service.ts`
- `apps/web/src/components/ComandaDrawer.tsx`

## O que o código faz HOJE (evidências)

`apps/api/src/modules/orders/orders.service.ts:720` — `reversePayment(companyId, id, pid)`:

- `apps/api/src/modules/orders/orders.service.ts:721` carrega a comanda mas **descarta o resultado**
  (`await this.loadOrder(...)` sem atribuir) → o status da comanda não influencia nada.
- `apps/api/src/modules/orders/orders.service.ts:727` faz **apenas** `orderPayment.update({ status: 'reversed' })`.
- Não toca em `Transaction`, `CashMovement` nem `CommissionEntry`.

O comentário em `apps/api/src/modules/orders/orders.service.ts:719` diz explicitamente
"Estorno permanece permitido mesmo com a comanda finalizada" — ou seja, é intencional permitir,
mas a contrapartida contábil nunca foi escrita.

Consequência (confirmada pela auditoria em runtime): comanda faturada com pagamento de R$100 gera
Transaction paid 100 + CashMovement in 100 + CommissionEntry. Depois do estorno, o pagamento fica
`reversed`, mas **os três lançamentos continuam lá**. O caixa fecha com sobra fantasma e a comissão
segue devida sobre uma venda estornada.

## Maquinaria de estorno que JÁ existe

`apps/api/src/modules/orders/orders.service.ts:1238` — `reverseFinishReconciliation(tx, companyId, order)`:
- `:1245` estorna as `Transaction` de receita da comanda (`status != reversed`, `reversalOfId: null`).
- (segue estornando caixa/comissão/estoque no mesmo método)

`apps/api/src/modules/orders/orders.service.ts:1406` — `reopen()`:
- `:1408` exige `status === 'finished'`
- `:1411` `assertClosedCashAllowsOrderEdit` (não mexe em caixa já fechado)
- `:1413` chama `reverseFinishReconciliation` dentro da transação
- `:1417` volta o status para `open` e registra no `statusHistory`

## A UI já oferece o caminho certo

- Botão **Reabrir**: `apps/web/src/pages/ComandasPage.tsx:1831` e `apps/web/src/pages/ComandaDetalhePage.tsx:259`
- Botão de estornar pagamento: `apps/web/src/components/ComandaDrawer.tsx:982` — hoje aparece sempre que
  `p.status !== 'reversed'`, **sem olhar o status da comanda**.

## Decisão

Bloquear o estorno enquanto a comanda estiver `finished`, com mensagem mandando reabrir primeiro.

Por que assim, e não escrever o estorno parcial: `reopen()` já faz a reversão completa e testada
(receita + caixa + comissão + estoque) e respeita caixa fechado. Escrever um segundo caminho de estorno
parcial duplicaria regra financeira delicada e criaria uma nova fonte de divergência. O fluxo passa a ser
**Reabrir → estornar → faturar de novo**, todo ele por código já existente.

Fica registrado como follow-up: esconder/desabilitar o botão de estorno no drawer quando a comanda estiver
finalizada, para o usuário não levar um 400 (a mensagem já explica o caminho).
