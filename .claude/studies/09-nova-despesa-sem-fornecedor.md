# Estudo 09 — "Nova despesa" não deixa selecionar FORNECEDOR

Arquivos: `apps/web/src/pages/financeiro/TransacoesPage.tsx`, `apps/api/src/modules/financial/dto.ts`,
`apps/web/src/lib/queries/catalogo.ts`

## O que existe hoje

O formulário de lançamento (`apps/web/src/pages/financeiro/TransacoesPage.tsx:1267`) atende três modos:
`recebimento` (income), `vale` e `despesa` (expense).

Seletor de titular — `apps/web/src/pages/financeiro/TransacoesPage.tsx:1468`–`:1486`:
- `:1469` `recebimento` → lista **clientes**
- `:1478` `vale` **ou** `despesa` → lista **profissionais**

Ou seja: numa despesa só dá para escolher profissional. **Fornecedor não aparece em lugar nenhum**,
apesar de ser o titular natural de uma despesa (compra de produto, material, serviço de terceiro).

O corpo enviado (`:1363`–`:1368`) reforça isso:
```ts
...(partyId ? { partyId, partyType: mode === 'recebimento' ? 'customer' : 'professional' } : {})
```
`partyType` nunca é `supplier`.

## O backend JÁ suporta

`apps/api/src/modules/financial/dto.ts:36`–`:40`:
```ts
export enum PartyTypeDto { customer = 'customer', professional = 'professional', supplier = 'supplier' }
```
E `Transaction.partyType` existe no schema (`packages/db/prisma/schema.prisma:1643`).

Hook pronto no front: `apps/web/src/lib/queries/catalogo.ts:349` `useSuppliers(search?)`.

**Conclusão:** é lacuna só de tela. Nada de backend, migração ou tipo novo.

## Decisão

Na **despesa**, oferecer a escolha do tipo de titular (Fornecedor ou Profissional) e listar os
fornecedores quando for o caso, enviando `partyType: 'supplier'`. O `vale` continua exclusivamente
profissional (é adiantamento de comissão) e o `recebimento` continua cliente.

Fornecedor entra como padrão da despesa, que é o caso comum; trocar para profissional segue a um clique
(pagamento direto a um profissional continua possível).
