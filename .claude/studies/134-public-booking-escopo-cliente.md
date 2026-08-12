# Estudo 134 — cliente do portal só mexe no PRÓPRIO agendamento

Pedido do dono: fechar médio/baixo. Auditoria de 05/08 marcou `PublicBookingController`
como MÉDIO — os endpoints "my" já filtram, mas nunca havia teste que provasse.

## Evidências

- `apps/api/src/modules/public-booking/public-booking.service.ts:1093-1121` —
  `cancelMyAppointment` faz `customer.findFirst({ where: { companyId, userId:
  user.id } })` e depois `appointment.findFirst({ where: { id: appointmentId,
  companyId, customerId: customer.id } })`. **Filtro duplo por escopo.**
- `apps/api/src/modules/public-booking/public-booking.service.ts:964-1000` —
  `reviewMyAppointment` idem.
- `apps/api/src/modules/public-booking/public-booking.service.ts:1073-1091` —
  `updateMyProfile` atualiza `authUser` do próprio user, sem chegar em cliente
  de outro salão.

O código está certo. O que falta é a PROVA — se alguém remover o
`customerId` do `findFirst`, a suíte não detecta.

## Arquivos

- `apps/api/src/modules/usecase-tests/public-booking-escopo.usecases.test.ts`
  (novo) — 4 casos, incluindo o vazamento hipotético (A mexe no B).
