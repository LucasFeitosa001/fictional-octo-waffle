# Estudo 07 — Lote MEDIUM do front de comanda

Arquivos: `apps/web/src/pages/ComandasPage.tsx`, `apps/web/src/components/ItemEditDrawer.tsx`,
`apps/web/src/components/ComandaDrawer.tsx`, `apps/web/src/lib/queries.ts`

## H — Preço/desconto com vírgula vira 0 na Nova comanda

`apps/web/src/pages/ComandasPage.tsx:1498`–`:1500` (editor de item da comanda NOVA):

```ts
const qtyN   = Math.max(1, Math.floor(Number(quantity) || 1));
const priceN = Math.max(0, Number(unitPrice) || 0);
const discN  = Math.max(0, Number(discount)  || 0);
```

`Number("12,50")` é `NaN` → `|| 0` → **0**. Digitando no formato brasileiro o item entra com preço zero
(e, antes do fix G do backend, virava o preço cheio do catálogo — o valor digitado sumia duas vezes).

O arquivo **já tem** o parser correto: `apps/web/src/pages/ComandasPage.tsx:1615` `parseNum()`, que troca
vírgula por ponto e valida `Number.isFinite`. Ele só não estava sendo usado nessas três linhas.

**Correção:** usar `parseNum` nas três.

## N — "Sem profissional" nunca limpa o profissional do item

`apps/web/src/components/ItemEditDrawer.tsx:148` envia `professionalId: professionalId || undefined`.
Escolher "Sem profissional" produz string vazia → vira `undefined` → some do JSON.

No backend, `updateItem` (`apps/api/src/modules/orders/orders.service.ts:362`) só age quando o campo é
diferente de `undefined`:

```ts
if (dto.professionalId !== undefined) {
  data.professional = dto.professionalId ? { connect: ... } : { disconnect: true };
}
```

Ou seja: o caminho de `disconnect` **existe** e nunca era alcançado pela tela.

**Correção:** enviar `null` (não `undefined`) quando vazio. `null !== undefined` → entra no `if`; `null` é
falsy → `disconnect`. O `@IsOptional()` do DTO aceita null sem quebrar a validação. Tipo
`UpdateOrderItemBody.professionalId` (`apps/web/src/lib/queries.ts:361`) passa a aceitar `string | null`.

## O — Item adicionado em comanda existente não herda o profissional do cabeçalho

`apps/web/src/components/ComandaDrawer.tsx:212` `handleAddPicked` monta o `addItem` com
`kind`/`refId`/`unitPrice`/`quantity` e **sem `professionalId`** — o item nasce sem profissional e, se
ninguém editar item a item, **não gera comissão**. Na criação da comanda o comportamento já é o correto
(o item herda o profissional do cabeçalho — `apps/web/src/pages/ComandasPage.tsx`, `addItem` do
NovoComandaDrawer).

**Correção:** passar o `professionalId` do cabeçalho da comanda como padrão do item novo (continua
editável item a item). `AddOrderItemBody.professionalId` já existe (`apps/web/src/lib/queries.ts:311`).
