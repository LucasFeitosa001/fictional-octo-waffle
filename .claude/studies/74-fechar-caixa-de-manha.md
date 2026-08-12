# Estudo 74 — Não dá para fechar o caixa de manhã

Chamado do dono, urgente: *"tá dando erro que a data de fechamento não pode estar no futuro… a
Fátima Cabelos não tá conseguindo fechar o caixa hoje"*.

## 74.1 — O que acontece

`apps/web/src/pages/financeiro/CaixasAbertosPage.tsx:521` monta o carimbo assim:

```
...(closeDate ? { closedAt: new Date(`${closeDate}T12:00:00`).toISOString() } : {}),
```

**Meio-dia fixo**, interpretado no fuso do navegador. Para um salão no Brasil (UTC−3), fechar o caixa
do dia de hoje manda `15:00Z`.

Do outro lado, `apps/api/src/modules/cash-registers/cash-registers.module.ts:319` recusa:

```
if (informada.getTime() > Date.now() + 60_000) {
  throw new BadRequestException('A data de fechamento não pode estar no futuro.');
}
```

Conferido com o relógio no momento do chamado: **11:14 no Brasil, 14:14 UTC**. O carimbo de meio-dia
local vale 15:00 UTC — **46 minutos à frente**. Recusado.

Ou seja: **quem fecha o caixa antes do meio-dia sempre bate nesse erro**, todo dia, em qualquer
salão a oeste de Greenwich. Não é caso raro; é metade do expediente. O caixa aberto da Fátima é
`cms7w0nzr009qlf01l10xg548`, de 30/07 19:09.

## 74.2 — Correção

Duas pontas, e a do backend é a que desbloqueia na hora (a web depende de CloudFront e do service
worker chegarem ao navegador dela):

1. **`cash-registers.module.ts:319`** — parar de recusar por causa da hora. Se a data informada está
   à frente do relógio mas dentro de 24 h, o fechamento é **aparado para agora** em vez de virar
   erro. Continua recusando data realmente futura (outro dia), que é o abuso que a trava existia
   para impedir. A guarda de "antes da abertura" (`:322`) não muda.
2. **`CaixasAbertosPage.tsx:521`** — parar de carimbar meio-dia cego. Quando o dia escolhido é
   **hoje**, manda o horário atual; para dia passado, segue meio-dia daquele dia, que é o que
   representa bem um fechamento retroativo.

A correção do backend sozinha já resolve para todo mundo, inclusive para quem estiver com a versão
antiga da tela em cache — por isso ela vai primeiro.

## 74.3 — Certificação

`apps/api/src/modules/usecase-tests/cash-close-clamp.usecases.test.ts`, registrado em
`run-usecases.ts`: prova que horário algumas horas à frente é aparado para agora, que data de outro
dia continua recusada, e que fechamento anterior à abertura continua recusado.
