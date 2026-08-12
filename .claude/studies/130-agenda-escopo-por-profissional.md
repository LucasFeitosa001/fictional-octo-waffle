# Estudo 130 — escopo por profissional em setStatus/remove de agendamentos

Pedido do dono: cobertura crítica. A auditoria de 05/08 marcou
`AppointmentsController.setStatus/remove` como ALTO. `GAP: UC-AGD-002 —
isolamento e flags do profissional` já existia como skip (falha registrada), e
o cenário nunca foi coberto por teste que passasse.

## O que está no código

`apps/api/src/modules/appointments/appointments.controller.ts:254,278` — as
rotas `PATCH /appointments/:id/status` e `DELETE /appointments/:id` recebem
`professionalScope` do controller: se o usuário só tem `agenda:manage` (sem
`agenda:view_all`), o `professionalScope` é o próprio `professionalId` dele.

`apps/api/src/modules/appointments/appointments.service.ts:1218` — `setStatus`
chama `findOne(companyId, id, scopeProfessionalId)`.

`apps/api/src/modules/appointments/appointments.service.ts:215-241` — `findOne`
usa `findFirst({ where: { id, companyId, ...(scopeProfessionalId ?
{ professionalId: scopeProfessionalId } : {}) } })`. Se o agendamento é de
OUTRO profissional, o `findFirst` devolve `null` → `NotFoundException`.

## O que estava faltando

Teste que EXERCITE o findOne com scope, provando:

1. profissional com scope="pro-a" NÃO acha agendamento de "pro-b" → 404;
2. profissional com scope="pro-a" acha o próprio → 200;
3. sem scope (dono/`agenda:view_all`), acha qualquer agendamento da empresa;
4. `remove` respeita o mesmo scope — nada pode ser deletado por profissional
   que não é dono.

## Arquivos

- `apps/api/src/modules/usecase-tests/appointments-scope.usecases.test.ts`
  (novo).
