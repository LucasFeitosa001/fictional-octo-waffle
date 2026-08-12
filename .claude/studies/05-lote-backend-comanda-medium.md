# Estudo 05 — Lote MEDIUM do backend de comanda

Arquivo estudado: `apps/api/src/modules/orders/orders.service.ts`

## G — `unitPrice: 0` vira preço de catálogo (cortesia cobrada cheia)

`apps/api/src/modules/orders/orders.service.ts:312` monta `provided` a partir do dto e, em
`:320` (serviço) e `:327` (produto), decide:

```ts
return provided && provided.gt(0) ? provided : service.price;
```

`provided.gt(0)` é **falso quando o usuário digita 0**, então o item volta para o preço cheio do
catálogo. Não há como registrar cortesia/brinde pelo preço zero — o sistema silenciosamente cobra.

**Correção:** distinguir "não informado" (`null`) de "informado como zero". Passa a ser
`provided != null ? provided : catálogo`. O front sempre envia `picked.unitPrice` (o preço do catálogo)
ao adicionar, então zero só chega quando alguém digitou zero de propósito.

## K — `professionalId` de item sem validação de empresa (IDOR + 500)

- `addItem` — `apps/api/src/modules/orders/orders.service.ts:286` grava `professionalId: dto.professionalId`
  **sem checar** se o profissional é da empresa.
- `updateItem` — `apps/api/src/modules/orders/orders.service.ts:362` faz
  `data.professional = { connect: { id: dto.professionalId } }`: id inexistente → Prisma **P2025 (500)**;
  id de OUTRA empresa → item fica atribuído cross-tenant.

O `create()` já faz a validação certa (`apps/api/src/modules/orders/orders.service.ts:221`–`:233`:
junta os ids, `professional.count({ where: { companyId, id: { in } } })` e compara).

**Correção:** validar o `professionalId` contra a empresa nos dois métodos, com 404 claro.

## L — Desconto sem teto (500% zera a comanda)

`apps/api/src/modules/orders/orders.service.ts:663` `addDiscount` cria o desconto **sem validar valor**.
Em `recalculate` (`:1512`) um `percent` é aplicado como `gross * value / 100` — com `value = 500`
o desconto fica 5× o valor da comanda, o líquido trava em 0 e dá para faturar R$ 0 sem pagamento.

**Correção:** `percent` limitado a 0–100; `value` (fixo) não pode ser negativo nem passar do bruto.

## F — "Faturar" travado com "Restante: R$ 0.00"

`apps/api/src/modules/orders/orders.service.ts:808`:

```ts
if (!paidTotal.equals(netTotal)) {
  const remaining = Prisma.Decimal.max(netTotal.sub(paidTotal), 0);
  throw new BadRequestException(`Registre o pagamento completo antes de faturar. Restante: R$ ${remaining.toFixed(2)}.`);
}
```

Quando o **pago excede** o líquido (ex.: pagou 100, depois aplicou crédito ou removeu item e o líquido
caiu para 50), `netTotal - paidTotal` é negativo, `max(...,0)` devolve 0 e a mensagem vira
"Restante: R$ 0.00" — autocontraditória, e o operador não descobre que precisa estornar o pagamento.

**Correção:** tratar o excedente com mensagem própria, dizendo o valor pago, o valor da comanda e que é
preciso estornar a diferença.
