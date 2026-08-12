# Estudo 133 — DTO de Professionals sem normalização

Pedido do dono: fechar médio/baixo. Auditoria marcou `ProfessionalsController.update`
como ALTO — `phone`, `document`, `zip` sem validação de formato, e
`CommissionRuleDto.value` sem `@Min`/`@Max`.

## Evidências (arquivo:linha lidos)

- `apps/api/src/modules/professionals/dto.ts:17` — `@IsOptional() @IsString() phone?: string;`
- `apps/api/src/modules/professionals/dto.ts:25` — `@IsOptional() @IsString() document?: string;`
- `apps/api/src/modules/professionals/dto.ts:38` — `@IsOptional() @IsString() zip?: string;`
- `apps/api/src/modules/professionals/dto.ts:44` — `phone?: string;` no UpdateProfessionalDto
- `apps/api/src/modules/professionals/dto.ts:52` — `document?: string;` no UpdateProfessionalDto
- `apps/api/src/modules/professionals/dto.ts:65` — `zip?: string;` no UpdateProfessionalDto
- `apps/api/src/modules/professionals/dto.ts:82` — `@IsNumber() value: number;` no CommissionRuleDto (sem Min/Max)

## Furos

`apps/api/src/modules/professionals/dto.ts`:

- `phone?: string` (:17, :44) — mesmo bug do Customer: pode chegar `"5555555"`,
  gravar direto no banco;
- `document?: string` (:25, :52) — CPF/CNPJ sem DV, pode ser `"123"` ou `"abc"`;
- `zip?: string` (:38, :65) — CEP sem 8 dígitos;
- `CommissionRuleDto.value: number` (:82) — sem `@Min`, sem `@Max`. Dá para
  cadastrar rule de 999999% ou -50%.

Não vi endpoint que edita `pixKey` do profissional (o campo existe em
`Professional.pixKey`, mas não aparece no DTO nem em rota controller).
Consultei `grep -rn "pixKey" apps/api/src` — só o SalonPay lê, e os testes
escrevem via Prisma direto. Se um dia alguém expuser `pixKey` no DTO, este
estudo já registra que a normalização vai em `normalizarChavePix` (helper do
estudo 125).

## O que este estudo muda

- `Transform(normPhone)` em `phone`;
- `Transform(normDoc)` em `document` (aceita CPF ou CNPJ);
- `Transform(normCep)` em `zip`;
- `@Min(0) @Max(100)` em `CommissionRuleDto.value` quando `type: 'percent'`,
  `@Min(0)` quando `'fixed'` — como o DTO não sabe o `type` na hora, aplico
  `@Min(0)` e faço a checagem `<=100` para percent no service.

## Testes

`apps/api/src/modules/usecase-tests/professionals-dto.usecases.test.ts` (novo)
prova as três normalizações e a rejeição de valor negativo.
