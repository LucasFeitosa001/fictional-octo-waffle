# Estudo 39 — Rateio de auxiliares na comissão + encaixe de agendamento

Duas frentes que o dono autorizou na mesma sessão: *"pode fazer tudo isso ai"* (o rateio de
auxiliares, pendência registrada no estudo 38) e o pedido da Fátima — *"Teria como selecionar o
mesmo horário que já estava agendado com a mesma profissional? Mudando só a cliente"*.

---

## Frente 1 — Encaixe (`squeezeIn`)

### O que estava errado

`NewAppointmentModal.tsx:259` guardava o estado e `:1017` desenhava o switch
**"Encaixar agendamento"**, mas o payload nunca o enviava e a API não conhecia o conceito. Ou seja:
ligar o toggle não fazia nada, e a recepção tomava "horário ocupado" do mesmo jeito.

### Onde a colisão é decidida

`apps/api/src/modules/appointments/appointments.service.ts:235` — dentro da transação do `create()`,
depois do `pg_advisory_xact_lock`, o `assertNoOverlap` derruba com 409. O mesmo em `:374`, no
`createSeries()`.

### O que mudou (já aplicado, falta provar em runtime)

- `apps/api/src/modules/appointments/dto.ts:79` — `squeezeIn?: boolean` em `CreateAppointmentDto`
  (a DTO de série herda dela, `dto.ts:98`).
- `appointments.service.ts:237` e `:378` — os dois `assertNoOverlap` passam a rodar só
  `if (!dto.squeezeIn)`.
- `apps/web/src/lib/types.ts:403` — `squeezeIn?: boolean` em `CreateAppointmentBody`.
- `apps/web/src/components/NewAppointmentModal.tsx:489` — passa a enviar `squeezeIn`.

### Por que o primeiro teste deu 409 no caso 3

Não era o código: o processo servia `dist/` de 10:20 com **zero** ocorrências de `squeezeIn`
(`nest start` sem `--watch` não recompila). Rebuild limpo → `grep -c squeezeIn dist/...service.js`
= 2. Retestar os três casos contra o build novo.

### Fora do escopo (deliberado)

`assertWithinSchedule` (`:200`) continua valendo. Encaixe permite sobrepor **outro agendamento**;
não permite marcar fora do expediente do profissional — isso é outra regra e outro toggle. Sem
nenhuma `ProfessionalSchedule` no dia da semana, ele derruba com 400 *"Profissional não atende
neste dia da semana"*, e com janela que não cobre o intervalo, 400 *"Horário fora do expediente"*.

### O encaixe cobriu só metade: REAGENDAR continua bloqueado

Relato do dono (28/07): *"não estou consigo reagendar do Daniel para 10:30 no DesignModa"*, com o
toggle "Encaixar agendamento" visível no drawer.

Dado real da produção — `Bruna Lima` (`cmryy3o4h0008w5lj87ierjyj`), 30/07/2026:

```
10:30 → 10:45  confirmed  Paulo
10:45 → 11:00  confirmed  Daniel
```

O expediente dela é seg–sex 09:00–18:00, então 10:30 está DENTRO da janela. O que bloqueia é o
agendamento do Paulo. Ou seja: é exatamente o caso do encaixe — só que eu liguei `squeezeIn`
apenas no `create()` (`:238`) e no `createSeries()` (`:379`). Faltam:

- `appointments.service.ts:553` — `update()` chama `assertNoOverlap` **sem condição**; é por aqui
  que passa o reagendamento (`PATCH /appointments/:id`).
- `apps/web/src/pages/AgendaPage.tsx:664` — o estado `squeezeIn` existe e `:1863` desenha o toggle,
  mas `confirmReschedule` monta o body com `start/notes/remindClient/notifyConfirmation/
  notifyCancellation` e **não** manda o campo. Mesmo enfeite do NewAppointmentModal, outra tela.
- `apps/web/src/pages/AgendaPage.tsx`, `confirmReschedule` — o `catch` engole a mensagem da API e
  mostra sempre *"Não foi possível reagendar (horário indisponível)"*. Quem lê não descobre que o
  horário é do Paulo nem que o toggle resolveria.

Fora do escopo aqui: `:487` (bloqueio de horário) e `:635` (reativar status) continuam sem encaixe
de propósito — bloqueio existe para ocupar, e reativar não é escolha de horário.

### Prova em runtime

`apps/api/src/test/appointments-squeeze-in.e2e.ts` (novo), no molde de
`apps/api/src/test/orders-finish.e2e.ts:104` (`signUpStaff`) e `:163`-`:174` (sobe o Nest em
processo com o handler do better-auth). Cinco verificações: 201 no primeiro; **409 sem encaixe**
(a proteção contra dupla marcação acidental precisa continuar de pé — provar só o 201 seria provar
metade); 201 com encaixe; os dois agendamentos convivendo com clientes diferentes; e 400 quando o
encaixe tenta furar o expediente.

---

## Frente 2 — Rateio de auxiliares

### O modelo existe, o cálculo ignora

`packages/db/prisma/schema.prisma`, `model OrderItemAuxiliary`: `professionalId`, `discountFrom`
(`establishment | professional`), `valueType` (`percent | value`), `value`. A tela cria e apaga
(`orders.service.ts:441` `addAuxiliary`, `:458` `removeAuxiliary`) e o `findOne` devolve
(`orders.service.ts:139` e `:180`).

Mas `generateCommissionEntries` (`orders.service.ts:1100`) **nunca lê `auxiliaries`**: percorre
`order.items`, resolve o percentual do profissional principal e cria uma `CommissionEntry` só para
ele (`:1139`). O auxiliar não recebe nada e nada é descontado de ninguém.

Confirma a lacuna um teste que já existe e cobra exatamente isso:
`apps/api/src/modules/usecase-tests/financial-commissions.usecases.test.ts:153` — *"gera a parcela
do auxiliar cadastrado no item"*, com `assert.ok(created.some(e => e.professionalId === 'pro-aux'))`.

### A regra

Para cada item, sobre `base = grossValue - discount`:

1. **Cada auxiliar recebe.** `percent` → `base * value/100`; `value` → o valor cheio. O auxiliar foi
   cadastrado à mão naquele item, com valor à mão — isso *é* a decisão de pagar. Por isso **não**
   filtro por `receivesCommission` no auxiliar (esse flag é a regra-padrão do profissional do item,
   `:1129`); filtrar aqui faria a tela aceitar um rateio que o cálculo depois joga fora em silêncio.
2. **Teto acumulado.** Os auxiliares de um item não podem somar mais que a base do item. Cada um é
   limitado ao que sobrou (`remaining`), então dois auxiliares de 80% não viram 160% do serviço.
3. **`discountFrom = 'professional'`** → a soma sai da comissão do principal e fica gravada em
   `CommissionEntry.auxiliaryDiscount` (coluna "Desconto de Auxiliares" do Belasis).
   **`discountFrom = 'establishment'`** → o salão paga; o principal não é tocado e o campo fica 0.
4. **Nunca negativo.** O desconto é limitado à comissão do principal; grava-se o que de fato foi
   descontado, não o que se pretendia. Se o principal não tem comissão, o salão acaba pagando o
   auxiliar — e o número na coluna diz a verdade sobre isso.

### Onde encaixa

- `orders.service.ts:845` — a query do `finish()` (`items: { include: { professional: true } }`)
  precisa incluir `auxiliaries`, senão o campo chega `undefined` no cálculo.
- `orders.service.ts:1100` — a assinatura estrutural de `generateCommissionEntries` ganha
  `auxiliaries`.
- Estorno já está coberto: `reverseFinishReconciliation` marca `reversed` por `orderId`
  (`commissionEntry.updateMany`), então as entries do auxiliar entram junto.
- `packages/db/prisma/schema.prisma`, `model CommissionEntry` — coluna `auxiliaryDiscount` já criada
  pela migração `20260728120000_commission_auxiliary_discount` (aplicada no LOCAL; **falta a PROD**).

### Onde aparece na tela

- `apps/api/src/modules/commissions/commissions.service.ts:304` — o `map` do `detail()` devolve
  `baseAmount/commissionAmount/bonusAmount`; falta `auxiliaryDiscount`. Os totais em `:320`
  também.
- `apps/web/src/lib/queries/comissoes.ts:118` — `CommissionDetailItem` ganha o campo.
- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx:920` — `DETAIL_COLUMNS` ganha a coluna
  "Desconto de Auxiliares". A "Taxa acumulada" da referência já existe ali como **"Percentual"**
  (`:951`), calculada como `commissionAmount / baseAmount` — é a taxa efetivamente aplicada.

## Arquivos tocados

- `apps/api/src/modules/orders/orders.service.ts`
- `appsis/api/src/modules/commissions/commissions.service.ts` → `apps/api/src/modules/commissions/commissions.service.ts`
- `apps/web/src/lib/queries/comissoes.ts`
- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx`
- `apps/api/src/modules/appointments/appointments.service.ts`
- `apps/api/src/modules/appointments/dto.ts`
- `apps/web/src/lib/types.ts`
- `apps/web/src/components/NewAppointmentModal.tsx`
- `apps/api/src/test/commissions-auxiliary.e2e.ts` (novo)
