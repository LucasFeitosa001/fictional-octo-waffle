# Estudo 01 — `PATCH /orders/:id { status }` pula toda a reconciliação

Severidade: **HIGH** (integridade financeira)

## Arquivos estudados

- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/modules/orders/dto.ts`
- `apps/web/src/lib/queries.ts`

## O que o código faz HOJE (evidências)

`apps/api/src/modules/orders/orders.service.ts:1425` — `update(companyId, id, dto)`:

- `apps/api/src/modules/orders/orders.service.ts:1428` grava `notes` (ok).
- `apps/api/src/modules/orders/orders.service.ts:1429` `if (dto.status && dto.status !== order.status)`:
  - `apps/api/src/modules/orders/orders.service.ts:1431` só barra quando a comanda **já está** `finished`.
  - `apps/api/src/modules/orders/orders.service.ts:1434` caso contrário grava `data.status` **direto**, e
    `:1435` registra o `statusHistory` — sem passar por nenhuma reconciliação.

Transições hoje PERMITIDAS por esse caminho, todas sem efeito colateral correto:

| Transição | O que deveria acontecer | O que acontece pelo PATCH |
|---|---|---|
| `open → finished` | `finish()` (`:747`): receita, caixa, comissão, baixa de estoque | nada disso |
| `open → canceled` | `remove()` (`:1452`): estorno + devolve crédito/cashback + repõe estoque | nada disso |
| `canceled → open` | não existe fluxo legítimo | ressuscita comanda já estornada |

Os métodos corretos existem e têm guardas próprias:
- `apps/api/src/modules/orders/orders.service.ts:747` `finish()`
- `apps/api/src/modules/orders/orders.service.ts:1406` `reopen()` (chama `assertClosedCashAllowsOrderEdit` em `:1411` e `reverseFinishReconciliation` em `:1413`)
- `apps/api/src/modules/orders/orders.service.ts:1452` `remove()` (idem em `:1458` e `:1460`)

## Quem chama (fator decisivo para a correção)

- Backend expõe `PATCH /orders/:id` em `apps/api/src/modules/orders/orders.controller.ts` (handler `update`).
- Frontend: o hook existe em `apps/web/src/lib/queries.ts:275` (`useUpdateOrder`, `api.patch` em `:279`)
  mas **`grep -rnw useUpdateOrder` retorna apenas a própria declaração** — nenhum componente o usa.

**Conclusão:** travar a mudança de status nesse endpoint **não quebra nenhuma tela**. O risco que eu havia
levantado antes ("pode quebrar um fluxo que você usa") está descartado por evidência.

## Decisão

Rejeitar explicitamente qualquer troca de status em `update()`, com mensagem que aponta o caminho certo
(`/finish`, `/reopen`, `DELETE`). Explícito em vez de silencioso: se algum cliente antigo mandar `status`,
ele recebe 400 com instrução — em vez de "funcionar" e corromper o financeiro.

`notes` continua editável (é o uso legítimo do endpoint).
