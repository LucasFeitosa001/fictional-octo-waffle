# Estudo 125 — blindar DTOs que aceitavam lixo (o "5555555" e primos)

Pedido do dono em 05/08: *"o que das funções de back tá faltando test coverage.
veja 100% o mais crítico pra protegermos tipo isso que aconteceu"*, depois de o
telefone virar `"5555555"` no banco por uma máscara de UI falha.

O padrão do bug: **entrada de usuário sem validação de FORMATO no boundary do
Nest**. Se o front mandar lixo, o service grava lixo. A UI é a primeira defesa,
mas o servidor é a última — e ela estava aberta.

## Arquivos tocados

- `apps/api/src/modules/customers/dto.ts`
- `apps/api/src/modules/customers/dto-helpers.ts` (novo — normalizadores)
- `apps/api/src/modules/salonpay/salonpay.service.ts`
- `apps/api/src/modules/usecase-tests/customers-dto.usecases.test.ts` (novo)
- `apps/api/src/modules/usecase-tests/salonpay.usecases.test.ts` (novo)
- `apps/api/src/modules/usecase-tests/run-usecases.ts` (registro)

## Onde estava o furo

`apps/api/src/modules/customers/dto.ts:40-45,89-94` — `phone`/`cpf`/`cnpj` são
declarados apenas como `@IsString @MaxLength(32)`. Zero conferência de conteúdo.
`trimPhone` (:21) só corta espaços. Consequência direta: `POST /customers` com
`{ phone: "5555555", cpf: "abc" }` grava exatamente isso.

`apps/api/src/modules/salonpay/salonpay.service.ts:73-110` — `upsert` recebe
`taxId`, `phone`, `email`, `pixKey`, `zipCode` como strings livres. Só rejeita
`revenue<0` e `taxId` de tamanho inválido. Mesmo padrão do cliente.

Os `CustomersService.create/update` (:105, :142) NÃO exercitam validação — o
teste único que toca cliente (`customers-crm.usecases.test.ts`) mocka `create`
e nunca valida o DTO. A auditoria de 05/08 identificou como CRÍTICO #1.

## O que os helpers fazem

**`normalizarTelefone`** — devolve **só dígitos**, aceita 10 a 13 (nacional
brasileiro ou E.164 até 13). Rejeita <10 (o bug do "5555555"). Mantém o `+`
inicial fora do valor gravado, para o formato interno seguir sendo "só
dígitos", como o resto do código espera (`voltr-forwarder`, `notifications`
usam matching por dígitos finais).

**`normalizarCpf` / `normalizarCnpj`** — validam com o algoritmo de dígito
verificador. CPF/CNPJ fake ("abc", "111.111.111-11") são rejeitados. Zero
biblioteca externa: dois cálculos de checksum, cabem em ~40 linhas.

Não usei `class-validator/@Matches` porque o teste da máscara BR ficaria
frágil (regras diferentes para 10 vs 11 dígitos). Um `@Transform` + validador
custom é mais legível e roda uma vez, na fronteira.

## O que fica de FORA da mudança (proposital)

- Base antiga com telefones truncados NÃO é limpa em massa por esta mudança —
  isso é decisão do dono, não do DTO. A validação pega da próxima gravação em
  diante;
- `email` já usa `@IsEmail`, então não muda;
- `birthday` já usa `@IsISO8601`;
- Nomes com número ("Fulana 123") continuam aceitos — não é escopo.

## Testes que travam isso

Cada helper tem teste próprio (formato inválido, formato válido, casos-limite);
o `CustomersService.create/update` ganha teste que prova a rejeição para
telefones curtos e docs inválidos, e a aceitação de formatos comuns. Padrão
`node:test`, entrando no `run-usecases.ts`.

O teste NÃO é mock cego: monta um Prisma mínimo que registra o que ia gravar.
Se algum validador for removido, a gravação passa a acontecer com o lixo e o
teste falha.

## Arquivos do módulo 2 (SalonPay)

- `apps/api/src/modules/salonpay/dto.ts` — DTO passa a validar `taxId` (CPF/CNPJ
  com DV), `phone` (>= 10 dígitos) e `zipCode` (8 dígitos) no boundary. O
  `email` já usava `@IsEmail`.
- `apps/api/src/modules/salonpay/salonpay.service.ts` — o `somenteDigitos`
  interno vira redundante, mas fica; a validação de tamanho de `taxId` no
  `avaliar()` também segue, como segunda defesa.
- `apps/api/src/modules/usecase-tests/salonpay.usecases.test.ts` (novo) —
  reproduz `{ taxId:"123", phone:"tel" }` e confere que o DTO rejeita antes de
  o service ver.
