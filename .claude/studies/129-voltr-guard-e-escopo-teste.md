# Estudo 129 — testes de escopo do VoltrSignatureGuard

Pedido do dono: cobertura crítica. A auditoria de 05/08 apontou o
`VoltrSignatureGuard` como CRÍTICO #4 — ele já teve 3 furos que passaram por
code review no último mês.

## O que o guard faz

`apps/api/src/modules/voltr/voltr-signature.guard.ts:150-163` —
`escopoLiberado(schema, exigido)` lê `process.env.VOLTR_SCOPES`, no formato:

```
alecrim:mensagem|agenda,designmoda:mensagem
```

- Split por vírgula → cada tenant tem uma linha `slug:esc1|esc2`;
- Match do slug (schema sem `emp_`);
- Split dos escopos por `|`;
- `.includes(exigido)` → true/false.

Fail-closed: slug não listado, ou escopo não listado, ou env vazia → false → 403.

## Furos que os testes protegem

1. **Segredo de "mensagem" NÃO abre "agenda"**. Se um dia alguém trocar
   `.includes(exigido)` por `.startsWith(exigido)`, o teste vê e falha.
2. **Fail-closed com env vazia**. Se algum default trocar `false` por `true`,
   pega.
3. **Slug não listado é 403** — mesmo com o segredo correto do tenant.
4. **Distinção entre schemas** — `emp_alecrim` no VOLTR_SCOPES não libera
   `emp_alecrimdois`.
5. **Escopo múltiplo separado por `|`** funciona nos dois lados.

## Arquivos

- `apps/api/src/modules/usecase-tests/voltr-guard-escopo.usecases.test.ts`
  (novo) — testes de `escopoLiberado` acessado via `as any` (é private).
