# Estudo 19 — "Nenhum horário disponível nesta data." em data passada

Relato: ao abrir um agendamento de **24/07/2026** com a profissional **LAILA ARAUJO LUZ SOUSA** e o
serviço **ADIANTAMENTO MORENO ILUMINADO**, o campo Horário mostra
*"Nenhum horário disponível nesta data."* Hoje é **27/07/2026** — a data pedida está 3 dias no passado.

## O que NÃO é (verificado no banco de produção)

- LAILA está `active = true`.
- 24/07/2026 é **sexta**; ela tem horário de sexta **08:00–20:00** (e os 7 dias preenchidos).
- `ADIANTAMENTO MORENO ILUMINADO` existe, `deletedAt = null`, duração 15min.
- O vínculo `ProfessionalService` LAILA × esse serviço **existe** (ela tem os 65 serviços da empresa).

Ou seja, todas as guardas de saída antecipada de `availability()`
(`apps/api/src/modules/appointments/appointments.service.ts:823`-`:865`) passam.

## Causa raiz

`apps/api/src/modules/appointments/appointments.service.ts:893`:
```ts
// Skip slots already in the past.
if (slotEnd <= now) continue;
```
Todo slot de um dia **inteiramente no passado** cai nesse `continue`, então `slots` volta vazio e o
front imprime a mensagem de "nenhum horário". Não tem nada a ver com a profissional: **qualquer**
profissional, em **qualquer** data anterior a hoje, dá a mesma tela.

O comportamento certo depende de quem pergunta:

- **Agendamento online** (`apps/api/src/modules/public-booking/public-booking.service.ts:440`-`:449`
  chama a mesma `availability()`): o cliente NÃO pode marcar no passado — pular o passado está certo.
- **Painel interno** (`apps/api/src/modules/appointments/appointments.controller.ts:77`-`:93`): o salão
  lança atendimento retroativo o tempo todo (esqueceram de registrar, estão migrando dados). Aqui
  bloquear o passado é o defeito.

## Correção

`availability()` ganha `opts?: { includePast?: boolean }`, default **false** (mantém o público como
está). O controller do painel (`appointments.controller.ts:87`) passa `includePast: true`.

`apps/api/src/modules/appointments/appointments.service.ts:889` (`const now = Date.now()`) vira uma
referência que só filtra quando `includePast` é falso.

## Parte 2 — profissional ativo sem horário/serviço

Pedido do dono: *"eu quero todos profissionais ativos com horario e serviços, para não amostra
'Nenhum horário disponível nesta data.'"*

As mesmas guardas de `:823`-`:865` devolvem vazio quando o profissional não tem
`ProfessionalService` do serviço pedido ou não tem `ProfessionalSchedule` no dia. Então, além do
código, é preenchimento de dado em produção — para TODA empresa, não só a Fátima.

Regra **somente aditiva**, para não atropelar salão que configurou de propósito:

- Serviços: preenche só quem tem **ZERO** vínculo. Quem já tem algum vínculo está curado à mão e não
  é tocado.
- Horários: preenche só quem tem **ZERO** horário, usando a janela mais frequente da própria empresa
  por dia da semana; empresa sem nenhum horário cadastrado usa seg–sáb 09:00–18:00.
- Nada é removido em nenhum caso.
