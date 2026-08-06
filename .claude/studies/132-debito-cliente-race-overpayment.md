# Estudo 132 — pagamento de débito em corrida (overpayment)

Pedido do dono: fechar médio/baixo. `CustomersService.addDebtPayment` foi
classificado como ALTO na auditoria de 05/08 — tinha lógica correta contra
overpayment na leitura, mas nada contra RACE.

## O furo

`apps/api/src/modules/customers/customers.service.ts:421` (antes) — o método
fazia:

1. `customerDebtPayment.aggregate({_sum:amount})` para ler `prevPaidAgg`;
2. Se `dto.amount > saldo` → 400;
3. `customerDebtPayment.create(...)`;
4. `customerDebt.update({ status })`.

Sem transação, sem lock. Dois `POST /customers/:id/debts/:debtId/payments` de
R$100 num débito de R$100 chegando ao mesmo tempo:

- Req A: lê `prevPaidAgg=0` → saldo=100 → passa a trava (100 ≤ 100) → cria
  payment #1;
- Req B: lê `prevPaidAgg=0` (A ainda não commitou) → saldo=100 → passa a trava
  → cria payment #2;
- Ambos passam o `customerDebt.update`. Débito fica com 2 payments de R$100
  cada, sobre um valor original de R$100. `status='paid'` de qualquer jeito.

Resultado: o cliente pagou R$200 num débito de R$100. O caixa ganha dinheiro
"extra" que nenhum lugar do sistema explica.

## O que este estudo muda

- `addDebtPayment` inteiro dentro de `$transaction(async tx => ...)`;
- `pg_advisory_xact_lock(hashtext(debtId))` no começo — serializa as
  tentativas por DÉBITO (dois débitos diferentes do mesmo cliente não
  competem);
- Toda leitura/write dentro do `tx` — a segunda tentativa, quando entra, lê
  `prevPaidAgg = 100` (a A já commitou) e é rejeitada com "Pagamento excede o
  saldo devedor restante";
- Fallback `typeof $queryRaw === 'function'`: fixtures antigos de teste
  (Prisma simplificado) não têm — em produção sempre tem.

## Teste

`apps/api/src/modules/usecase-tests/customers-debt-race.usecases.test.ts`
simula concorrência com um `$queryRaw` de mentira que segura o lock. Duas
chamadas em `Promise.all` — só UMA cria payment, a outra é `BadRequestException`.

Sem o advisory lock, o teste vê dois `customerDebtPayment` criados e falha.
