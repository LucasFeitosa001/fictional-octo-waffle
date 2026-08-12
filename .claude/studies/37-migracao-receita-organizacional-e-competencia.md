# Estudo 37 — Migração: receita organizacional e data de competência

Autorizado pelo dono: *"pode fazer a migração dos dois toggles"*. São os dois campos da referência
`belasis-reference/_spec-paridade/02-editando-recebimento.png` que não existiam no schema.

## 1. "É uma receita organizacional?" — e o que isso significa AQUI

A referência traz o toggle com o subtexto **"Se ativo, não vincula a nenhum caixa"**.

No nosso código esse vínculo é concreto, não decorativo:
`apps/api/src/modules/financial/financial.service.ts:144`-`:157` (`assertTransactionPolicy`) recusa
um lançamento **pago** quando `allowTransactionsWithClosedCash` está desligado e não há caixa aberto:

```
'Abra o caixa antes de registrar uma movimentação paga.'
```

Ou seja: marcar "organizacional" tem de **dispensar essa exigência**. É uma despesa/receita da
empresa (aluguel, imposto, aporte) que não passa pelo caixa da recepção. Sem isso o toggle seria um
enfeite.

Coluna: `isOrganizational Boolean @default(false)` em `Transaction`.

## 2. "Ajustar data de competência"

`Transaction` (`packages/db/prisma/schema.prisma`) tem `dueDate` e `paidAt`, e nada de competência —
foi por isso que o radio "Tipo de data" do filtro ficou com 2 opções em vez das 3 da referência
(estudo 33). Competência é a data em que o fato econômico pertence ao período, independente de
quando vence ou é pago.

Coluna: `competenceDate DateTime?` em `Transaction`, e a opção passa a existir em
`TransactionDateTypeDto` (`apps/api/src/modules/financial/dto.ts`), que hoje só tem `due | paid`
e é lida em `financial.service.ts` para escolher sobre qual campo o período incide.

## Por que a migração é segura

As duas são **aditivas**: uma booleana com default e uma data anulável. Nenhuma linha existente
muda de comportamento — `isOrganizational` nasce `false`, que é exatamente a regra de hoje, e
`competenceDate` nasce nulo, então filtrar por competência simplesmente não traz o histórico até
alguém preencher.

**Não** vou retroalimentar `competenceDate` com `dueDate` nas linhas antigas: seria inventar um dado
contábil que ninguém informou. Se o dono quiser, é um UPDATE de uma linha, e aí é decisão dele.

## Cuidado com o histórico de migrations

A memória `migracao-banco-5434-divergencia` registra que o banco local tem histórico divergente:
aplicar por `migrate dev`/`deploy` cego quebra. O caminho é `db execute` do SQL aditivo +
`migrate resolve --applied`, tanto no local (5434) quanto na RDS de produção.

## Arquivos tocados

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/<nova>/migration.sql`
- `apps/api/src/modules/financial/dto.ts`
- `apps/api/src/modules/financial/financial.service.ts`
- `apps/web/src/lib/queries/financeiro.ts`
- `apps/web/src/pages/financeiro/TransacoesPage.tsx`
