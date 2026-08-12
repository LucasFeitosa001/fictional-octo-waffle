# Estudo 51 — O drawer de pagamento soma comissão JÁ PAGA no líquido

Relato do dono, com a tela aberta na FATIMA LACERDA: *"na hora de pagar as comissões, o líquido tá
vindo errado, no drawer de pagamento, ajuste isso, é crítico"*. A tela mostrava
`Comissões R$ 528,07 · Vales R$ 0,00 · Bonificações R$ 0,00 · Líquido R$ 528,07`.

## O defeito

`apps/web/src/components/PagarComissaoDrawer.tsx:121`-`:129`:

```tsx
function amountFor(row: CommissionSummaryRow): number {
  ...
  const gross = row.comissao + row.bonus - advancesTotal;   // ← período INTEIRO
  return gross > 0 ? gross : 0;
}
```

e o mesmo em `:136`-`:147` (`totais`, que alimenta os três cards de topo) e em `:382`/`:389` (a
fórmula por profissional).

`comissao` e `bonus` são os totais **do período, incluindo o que já foi pago**. O subconjunto
pagável tem campos próprios, declarados em `apps/web/src/lib/queries/comissoes.ts:57`-`:62`:

```ts
/** Só o que está EM ABERTO — é o subconjunto que o botão "Pagar" registra. */
comissaoAberta: number;
bonusAberto: number;
totalAberto: number;
/** Em aberto + bônus − vales, nunca negativo. É o que o botão paga. */
liquido: number;
```

A tela de Comissões já usa os campos certos no rodapé
(`pages/comissoes/ComissoesResumoPage.tsx:270`-`:273`, com o comentário "o rodapé fica em cima do
botão que paga, então tem que mostrar o mesmo número que ele vai registrar"). O DRAWER ficou para
trás.

## O tamanho do erro, no dado real da Fátima (produção)

Período padrão da tela (29/06 → 29/07/2026), somando `commissionAmount + bonusAmount` e ignorando
estornos:

```
FATIMA LACERDA   total do período = 528,07 | EM ABERTO = 462,00 (8 lançamentos) | já pago = 66,07 (3)
LARISSA SOUZA    total do período = 1.284,50 | EM ABERTO = 0,00 | já pago = 1.284,50 (24)
```

Os **R$ 528,07** da captura do dono são exatamente o total do período. O que o backend quitaria são
**R$ 462,00** — `payItem` seleciona só `status = 'open'` dentro do recorte. Ou seja: a tela promete
R$ 66,07 a mais do que o pagamento registra.

O backend está certo; quem mente é a tela. E mente para MAIS, que é o pior lado: o salão paga
por fora o valor que leu ali.

## Correção

1. `amountFor` e `totais` passam a somar `comissaoAberta` / `bonusAberto`.
2. A fórmula por profissional idem.
3. Quando houver diferença (`comissao > comissaoAberta`), a linha do profissional diz quanto já foi
   pago no período. Sem isso, quem viu 528,07 na lista e 462,00 no drawer acha que o drawer quebrou
   — a lista mostra o período inteiro de propósito.

## Arquivos tocados

- `apps/web/src/components/PagarComissaoDrawer.tsx`

## 51.4 — Certificação por teste (pedido do dono)

*"faça uns 10 testes unitários, pra poder certificar"*. O arquivo novo é
`apps/api/src/modules/usecase-tests/commissions-pagamento.usecases.test.ts`, no mesmo formato dos
que já rodam por `pnpm --filter @beautypass/api test`
(`modules/usecase-tests/run-usecases.ts` carrega todos os `*.usecases.test.ts`).

O alvo é `CommissionsService.payItem` (`modules/commissions/commissions.service.ts:500`), que é
onde a regra mora de verdade — `createPayment` (`:784`) e `payBulk` (`:814`) só o chamam dentro de
uma transação. Cada teste trava uma linha do método:

- `:507`-`:511` — recorte por `status: 'open'`, empresa e profissional;
- `:516`-`:517` — `competenceDate` só quando a tela mandou `from`/`to` (`inclusiveDateRange`);
- `:518`-`:520` — `entryIds` restringe aos escolhidos;
- `:533`-`:536` — `advanceIds` ausente × vazio (desconta todos × nenhum);
- `:545`-`:550` — recusa quando não há entry em aberto (o recibo fantasma de R$ 0,00);
- `:566`-`:584` — vale consumido até o limite, com o residual recriado em aberto;
- `:588`-`:591` — `paidAt` inválido;
- e o `updateMany` que marca as entradas como `paid` amarradas ao `paymentId`.

O duble de transação é o mesmo padrão do `financial-commissions.usecases.test.ts:33` (`paymentTx`),
com um espião no `where` para provar o recorte — não dá para afirmar "paga só o que está em aberto"
olhando só o total devolvido.
