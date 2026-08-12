# Estudo 84 — O acompanhamento pós-atendimento nunca disparou

Pergunta do dono sobre "Acompanhamento (depois do atendimento)": escolheu `1 segundo` e queria saber
se a mensagem chegaria 1 segundo depois. Resposta: não chegaria nunca.

## 84.1 — A prova

Histórico de envios de TODA a produção, por tipo:

```
confirmation   28   última 31/07
reminder       14   última 31/07
cancellation    8   última 31/07
ai / manual / invite / manager …
followup        0   NUNCA
```

`QUEUES_ENABLED = false` nas variáveis do App Runner. Com isso
`apps/api/src/modules/queues/queues.service.ts:193` sai na primeira linha e o trabalho nunca é
agendado:

```
async enqueueFollowUp(...) {
  if (!this.queuesEnabled) return;
```

O lembrete sobrevive a isso porque tem um fallback que varre o banco
(`whatsapp-reminder-poller.service.ts:62`-`:64`, ligado justamente quando `QUEUES_ENABLED === 'false'`),
mas ele cobre **só** `reminder_24h` e `reminder_2h` (`:140`). Não existe equivalente para o
acompanhamento. Tela grava, ninguém consome.

## 84.2 — O gatilho não é o fim do horário

`appointments.service.ts:1119` chama `enqueueFollowUp` quando o status vira `done`/`finished`
(e `orders.service.ts:1091` quando a comanda fecha). O atraso é aplicado no enfileiramento
(`queues.service.ts:194`-`:197`), então "1 segundo" significa 1 segundo depois de **marcar como
concluído**, não 1 segundo depois das 19:00. Isso está certo e não muda.

## 84.3 — O que já existe e NÃO deve ser reescrito

`apps/api/src/modules/queues/processors/follow-ups.processor.ts` tem a lógica boa toda:

- idempotência por marcador `Notification` (`FOLLOW_UP_TYPE`, `:60`-`:66`);
- dedupe da mesma visita entre agendamento e comanda (`:116`-`:132`);
- para de perseguir quem já reagendou (`:140`);
- link de reagendamento opcional (`:148`) e composição do texto (`:152`);
- recorrência com limite (`:190`-`:205`).

No caminho do follow-up o `job` só é usado para `job.name` (`:73`) e `job.data` (`:78`). Dá para
extrair o corpo para um método público e ter dois chamadores: o worker do BullMQ e o poller novo.

## 84.4 — Quando o atendimento foi concluído

`Appointment` não tem carimbo de conclusão; `updatedAt` (`schema.prisma:1187`) muda em qualquer
edição e não serve. Mas `AppointmentStatusHistory` (`:1219`-`:1231`) tem `toStatus` e `at`, é
gravada de verdade em `appointments.service.ts:1072`, e em produção já tem dados:
`finished` 6, `done` 2, `confirmed` 21, `canceled` 12. É esse o instante certo.

## 84.5 — Correção

1. **`follow-ups.processor.ts`** — extrair o corpo do follow-up para um método público
   (`executarFollowUp`), sem mudar comportamento; `process()` passa a chamá-lo.
2. **`apps/api/src/modules/notifications/followup-poller.service.ts`** (novo) — espelha o poller de
   lembrete: mesmo gate (`QUEUES_ENABLED === 'false'`), mesmo `canSendWhatsapp`, mesmo `runOnce`
   público para teste. Acha agendamento concluído cujo `AppointmentStatusHistory.at` + prazo já
   venceu e que ainda não tem marcador, e chama `executarFollowUp`. Cuida também da recorrência,
   já que `enqueueFollowUp` continua no-op.
3. **`apps/api/src/modules/notifications/notifications.module.ts`** — registrar o poller.
4. **Envio manual pelo visualizador** — o dono pediu poder mandar o acompanhamento quando quiser,
   mesmo depois de finalizado:
   - `appointments.service.ts`: método que compõe o mesmo texto e enfileira com `authorized: true`
     (uma pessoa clicou), idempotente por `requestKey`;
   - `appointments.controller.ts` + `dto.ts`: rota nova, `@RequirePermission('agenda:manage')`;
   - `apps/web/src/lib/queries/confirmationMessages.ts`: mutação;
   - `apps/web/src/components/AppointmentConfirmationDrawer.tsx`: botão.

## 84.6 — O que NÃO muda

Automação continua desligada por padrão: o poller só envia se `cfg.enabled` (espelho de
`automation.followUp`) estiver ligado — a mesma checagem que o processador já faz (`:164`). O envio
manual exige clique e autorização explícita. Nada contorna o portão de entrega, o opt-in do cliente
nem o cooldown por destinatário (`followup` está em `CLIENT_AUTOMATION_KINDS`,
`whatsapp.service.ts:186`-`:192`).
