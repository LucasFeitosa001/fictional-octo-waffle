/**/
# Estudo 146 — "Internal server error" ao pagar comissão: a trava nunca rodou

Relato do dono, em produção: clicar em pagar comissão devolve **Internal server
error**. Reproduzido contra a API de produção com a conta dele:

```
POST /api/v1/commission-payments  {"professionalId":"cmryy3ou0000fw5ljese58caj"}
→ 500 {"statusCode":500,"message":"Internal server error"}
```

## Arquivos tocados

- `apps/api/src/modules/commissions/commissions.service.ts`

## A causa

`commissions.service.ts:519-521` (a trava contra pagamento em dobro, do estudo
127):

```sql
SELECT pg_advisory_xact_lock(hashtext(${companyId})::bigint, hashtext(${professionalId})::bigint)
```

O `pg_advisory_xact_lock` tem duas assinaturas no Postgres:

| assinatura | chaves |
|---|---|
| `pg_advisory_xact_lock(bigint)` | uma de 64 bits |
| `pg_advisory_xact_lock(int, int)` | **duas de 32 bits** |

A versão de DOIS argumentos recebe `int4`. `hashtext()` já devolve `integer` —
o `::bigint` promove os dois para `int8` e aí **não existe função com essa
assinatura**. Provado no banco:

```
BEGIN; SELECT pg_advisory_xact_lock(hashtext('empresa')::bigint, hashtext('prof')::bigint);
ERROR:  function pg_advisory_xact_lock(bigint, bigint) does not exist

BEGIN; SELECT pg_advisory_xact_lock(hashtext('empresa'), hashtext('prof'));
 pg_advisory_xact_lock
-----------------------
```

O `$queryRaw` estoura, a transação inteira aborta e o Nest devolve 500 genérico.
Como o lock é a PRIMEIRA coisa que `payItem` faz (`:543`), **nenhum pagamento de
comissão jamais chegou a acontecer** desde que o estudo 127 entrou.

Pior: o comentário logo acima (`:503`) afirma que `bigint, bigint` é o que a
função aceita. Estava errado e por isso ninguém releu.

## Por que os testes não pegaram

`travarPagamentoConcorrente` sai cedo quando `tx.$queryRaw` não é função
(`:516-518`), e os fixtures do `usecase-tests` são um Prisma simplificado — o
caminho do SQL nunca é exercitado. O teste da corrida
(`commissions-race.usecases.test.ts:109`) monta o próprio `$queryRaw` e só
verifica se a string CONTÉM `pg_advisory_xact_lock`; nunca executa o SQL contra
um Postgres de verdade. Ou seja: a suíte provava que a chamada era feita, não
que ela funcionava.

## A correção

Tirar os dois `::bigint` — `hashtext()` já entrega `int4`, que é o tipo da
versão de duas chaves. O comentário foi corrigido junto.

`customers.service.ts:577` usa a versão de UM argumento
(`hashtext(${debtId})::bigint`) e está CERTO — ali `bigint` é a assinatura
válida. Conferido no banco; não foi alterado.

`appointments.service.ts:829` e `:1084` já usavam `hashtext(a), hashtext(b)` sem
cast, corretos.

## Nota

O defeito é meu: escrevi essa trava no estudo 127 e a validei por leitura e por
teste com Prisma falso, sem nunca executar o SQL contra um Postgres. Passou a
impressão de estar protegido enquanto a função inteira estava derrubada.
