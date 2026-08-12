# Estudo 46 — Pagamento sem forma, taxa de cartão nunca aplicada, e comissão que não nasce em silêncio

Três achados que se cruzam, todos verificados no código e em dado REAL da produção do dono.

## 46.1 — "Cartão" e "Outros" gravam pagamento SEM forma

`apps/web/src/components/ComandaDrawer.tsx`, sub-drawer de Pagamentos (o comentário `Pagamentos
(f_055)` marca o bloco). O atalho resolve para uma forma cadastrada **só quando é "Dinheiro"**:

```ts
const selectedQuickMethod = useMemo(() => {
  if (quickMethod !== 'Dinheiro') return null;      // ← Cartão e Outros saem aqui
  return methodList.find((m) => normalizar(m.name) === 'dinheiro') ?? null;
}, [methodList, quickMethod]);

function paymentBody(value: number) {
  const resolvedMethodId = methodId || selectedQuickMethod?.id;
  return {
    paymentMethodId: resolvedMethodId || undefined,   // ← fica undefined
    description: resolvedMethodId ? undefined : quickMethod,
  };
}
```

No faturamento (`orders.service.ts`, `generateIncomeTransactions`):

```ts
const accountId =
  p.accountId ??
  (p.paymentMethodId ? defaultAccountByMethod.get(p.paymentMethodId) ?? null : null);
```

Sem forma → **`accountId` nulo**: a receita entra no Financeiro sem conta. O movimento de caixa
acontece de qualquer jeito, então o caixa fecha; o que se perde é a conta e o vínculo com a forma.

Dado real (DesignModa): a comanda **#9** tem `pgto R$ 3 forma=NULA status=paid`.

## 46.2 — `feePercent` e `settlementDays` são cadastrados e nunca aplicados

`grep -rn "feePercent|settlementDays" apps/api/src/modules` devolve **apenas**
`financial/dto.ts:152`, `:153`, `:165`, `:166` — o DTO de cadastro. Nenhum leitor.

O salão cadastra "Cartão de Crédito 3,5%, liquida em 30 dias", vende R$ 100 e o sistema registra
R$ 100 disponíveis hoje. O correto seria R$ 96,50 daqui a 30 dias.

Isso explica outro sintoma já observado: o card **"Comissões a liberar"** é R$ 0,00 por
construção, porque `availableDate` sempre nasce como "agora"
(`orders.service.ts` no `create` da entry) — nunca com o prazo do cartão.

## 46.3 — Comissão não nasce e NADA avisa

Relato: *"não vi novas comissões da Bruna e do Lucas quando faturei"*. Verificado na produção:

```
#11 finished  item prof=Lucas Feitosa  recebeComissao=true  bruto=2  → comissões geradas: 0
#9  finished  item prof=Bruna Lima     recebeComissao=true  bruto=3  → comissões geradas: 0
#7  finished  item prof=Lucas Feitosa  recebeComissao=true  bruto=2  → comissões geradas: 0
```

Causa: **não há percentual em lugar nenhum**.

```
serviços: Unhas 0%  ·  Pes 0%
CommissionRule da empresa:      0
ProfessionalCommissionRule:     0
```

`generateCommissionEntries` faz `if (percent.lessThanOrEqualTo(0)) continue;` — está correto, 0%
significa "não comissiona". O defeito é o **silêncio**: o item é pulado sem registro, sem aviso na
comanda e sem pista na tela de Comissões. O dono fatura, espera comissão e não tem como descobrir
que faltou configurar.

É o mesmo padrão dos outros achados desta sessão: o sistema faz algo defensável e não conta.

## Correções

1. Atalhos "Cartão"/"Outros" resolvem forma cadastrada como o "Dinheiro" já faz; sem forma
   correspondente, avisam em vez de gravar pagamento órfão.
2. `finish()` aplica taxa e prazo: a receita entra líquida (`feePercent`) com `dueDate` deslocado
   por `settlementDays`, e a comissão do item passa a ter `availableDate` na mesma data — é o que
   faz "Comissões a liberar" existir de verdade.
3. `finish()` devolve o que foi PULADO por falta de percentual, e a tela avisa em vez de ficar
   calada.

## Arquivos tocados

- `apps/web/src/components/ComandaDrawer.tsx`
- `apps/api/src/modules/orders/orders.service.ts`
- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx`
- `apps/api/src/test/commissions-fluxo.e2e.ts`
