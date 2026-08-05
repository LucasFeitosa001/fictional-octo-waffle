# Estudo 126 — FinancialService: cross-tenant e estorno em corrida

Pedido do dono: cobertura crítica no backend, depois do bug do "5555555". A
auditoria de 05/08 marcou `FinancialService` como CRÍTICO #2 — 878 linhas
mexendo em dinheiro sem NENHUM teste.

## Furos que estavam no código

### (1) `createTransaction` aceitava `accountId` de outra empresa

`apps/api/src/modules/financial/financial.service.ts:734-748` (antes) — o método
chamava `assertTransactionPolicy` e o `prisma.transaction.create` direto, sem
conferir se `accountId`, `categoryId` ou `paymentMethodId` pertenciam à empresa
autenticada.

**Cenário reproduzível:** o operador da empresa X descobre um `accountId` da
empresa Y (aparece em log, screenshot, cURL do inspetor) e faz
`POST /financial/transactions` com `accountId=<da Y>`. A transação é criada com
`companyId=X` mas a conta apontada é da Y — o relatório de X vê o lançamento e a
conta da Y aparece "movimentada" onde não devia.

`createTransfer` (:679) já fazia a validação certa (busca as duas contas com
`where: { companyId }`), mas o `createTransaction` sozinho não. Mesmo problema em
`updateTransaction` (:750) — trocar `accountId` para uma conta de outra empresa
passava.

### (2) `reverseTransaction` estornava duas vezes em corrida

`apps/api/src/modules/financial/financial.service.ts:626` — a guarda
`if (original.status === 'reversed') throw` acontece ANTES do `$transaction`.
Duas requisições simultâneas (F5 duplo, retry do axios, duplo operador no mesmo
balcão) passavam pela checagem juntas e cada uma criava a sua contrapartida.
Resultado: o caixa ficava com **duas vezes o valor estornado**, dinheiro
"sumia" sem explicação.

## O que este estudo muda

### Blindagem cross-tenant

Novo helper `assertRecursosDaEmpresa` que roda ANTES do create/update. Para
cada id que veio no DTO (`accountId`, `categoryId`, `paymentMethodId`), faz um
`findFirst({ where: { id, companyId }, select: { id: true } })`. Se algum não
pertence, 400. O custo no caminho feliz são três SELECTs por linha índice, sem
impacto perceptível.

### Idempotência do estorno

`reverseTransaction` agora usa **interactive transaction** (`$transaction(async
tx => ...)`). Dentro dela:

1. `tx.transaction.updateMany({ where: { id, companyId, status: { not:
   'reversed' } }, ... })` — se A já estornou, B afeta 0 linhas;
2. Quando `count === 0`, `throw` — o Prisma faz rollback do create também;
3. Caso feliz: cria a contrapartida na mesma transação.

`updateMany` em vez de `update` porque o `where` do `update` do Prisma só aceita
identificador único — mas eu preciso de "id + status ≠ reversed" para a race não
passar. `count` é 0 ou 1 (id é único). Se for 0, alguém já reverteu.

## Testes

`apps/api/src/modules/usecase-tests/financial-cross-tenant.usecases.test.ts`
(novo) prova, com Prisma FALSO que aplica `where` de verdade sobre fixtures de
duas empresas:

- `createTransaction` com `accountId` da outra empresa → 400;
- `createTransaction` com `accountId` da própria empresa → 201;
- `createTransaction` sem `accountId` → 201 (organizacional);
- `updateTransaction` mudando `accountId` para uma conta de outra empresa → 400;
- `reverseTransaction` chamado duas vezes em concorrência (`Promise.all`) → só
  UMA cria contrapartida, a outra recebe `BadRequestException`.

O último caso é o mais delicado: o Prisma FALSO simula concorrência marcando o
status no update, e o segundo `updateMany` retorna `count: 0`. Se alguém
remover o filtro `status: { not: 'reversed' }`, o teste falha porque a segunda
contrapartida é criada.
