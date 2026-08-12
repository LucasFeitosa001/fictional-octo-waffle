# Estudo 127 — pagamento de comissão em dobro por corrida

Pedido do dono: cobertura crítica. A auditoria de 05/08 marcou o
`CommissionsService.payBulk/createPayment` como CRÍTICO #3 — o dono tinha três
incidentes registrados de "cliquei pagar duas vezes e a profissional recebeu
duas vezes".

## O furo

`apps/api/src/modules/commissions/commissions.service.ts:500` — `payItem` lê
`commissionEntry` com `status:'open'` no início da transação e faz o
`updateMany` para `paid` no fim. Entre a leitura e o update, no default do
Postgres (`READ COMMITTED`), outra transação pode ler as mesmas entries **antes
do commit da primeira** e criar seu próprio `CommissionPayment`.

Cenário reproduzível:

1. Operador clica "Pagar" na tela do Belasis;
2. Sem retorno imediato, clica de novo;
3. Duas requisições saem, chegam no `POST /commission-payments`, entram cada
   uma em sua transação;
4. Req A: lê 3 entries abertas → cria payment #1 → marca as 3 como paid;
5. Req B: começou ao mesmo tempo e ainda vê as 3 como open → cria payment #2
   sobre as MESMAS 3 entries → tenta marcar como paid (updateMany não impacta,
   já estão paid, mas o `create` do payment já rodou).

Resultado: **duas linhas em `CommissionPayment`** para as mesmas entries. A
profissional recebe o dobro. E o `registrarDespesa` também sai duplicado no
financeiro.

## Correção

`pg_advisory_xact_lock(hashtext(companyId), hashtext(professionalId))` no
começo de `payItem`. Duas transações concorrentes na MESMA dupla ficam
serializadas — a segunda espera a primeira commitar. Quando reentra na leitura,
`status:'open'` devolve `[]` (todas foram para paid) e cai no
`BadRequestException('Não há comissão em aberto para pagar…')` — sem write
duplicado, sem 500.

`xact_lock` (em vez de `advisory_lock` livre) é liberado automaticamente no fim
da transação. Não há risco de vazar entre requisições.

`hashtext(...)::bigint` porque a assinatura oficial do Postgres é
`pg_advisory_xact_lock(bigint[, bigint])`. Duas chaves (empresa + profissional)
dão granularidade fina — dois profissionais DIFERENTES da mesma empresa podem
ser pagos em paralelo sem competir pelo mesmo lock.

## Teste

`apps/api/src/modules/usecase-tests/commissions-race.usecases.test.ts` (novo)
usa um `Prisma.TransactionClient` de mentira que simula concorrência
sequencializando as duas chamadas mas emitindo o `updateMany` só depois de
ambas terem lido. Se o `advisory_xact_lock` for removido, o teste vê duas
`CommissionPayment` criadas para as mesmas entries. Com o lock, a segunda
recebe `BadRequestException`.

Testar advisory lock com Prisma de mentira exige simular a serialização — o
`$queryRaw` do `travarPagamentoConcorrente` vira uma barreira async
compartilhada no fixture, com semântica equivalente à do Postgres.
