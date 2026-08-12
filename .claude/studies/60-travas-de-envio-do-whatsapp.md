# Estudo 60 — Travas de envio do WhatsApp (a fila não pode virar bomba)

Contexto real, não hipotético: em 29/07/2026 o dono reconectou a sessão e a fila acumulada de
27 a 29/07 drenou de uma vez — três mensagens chegaram ao mesmo cliente em três minutos, inclusive
de agendamento **que já tinha passado**. Ele desconectou e disse: *"vou só conectar novamente quando
parar de enviar mensagem automático"*. Sobraram 9 linhas `pending` armadas em produção.

Regra permanente do projeto (CLAUDE.md + memória): mensagem automática só sai com o **padrão da
conta** ligado OU o **toggle daquele agendamento**. O opt-in do cliente é trava adicional, nunca
autorização.

## 60.1 — Por que a fila explode

`apps/api/src/modules/whatsapp/whatsapp.service.ts`:

- `enqueueText` (`:765`) grava a linha **sem olhar se existe socket aberto** — a mensagem entra na
  fila mesmo com o WhatsApp desconectado (`:877` cria a linha; o `drainOutbox` no fim, `:956`, só
  não acha socket e desiste).
- `drainOutbox` (`:1096`) sai do laço quando nenhuma company está aberta (`:1098`-`:1100`), então
  as linhas ficam `pending` **para sempre**: não há prazo de validade em lugar nenhum.
- `deliverOutbox` (`:1138`) envia o que achar pendente com `nextAttemptAt <= now`, sem reconferir
  nada além do socket (`:1153`) e do rate-limit (`:1156`). O texto e a decisão de enviar foram
  congelados no momento do enfileiramento.
- Cooldown por destinatário: `RECIPIENT_COOLDOWN_MS` = **60s** de padrão (`:159`-`:164`). Foi o que
  permitiu três mensagens ao Daniel em três minutos.

Ou seja: reconectar = drenar tudo o que se acumulou, com texto velho, para horário que já passou, e
sem reconferir se a autorização continua valendo.

## 60.2 — A autorização é lida cedo e congelada

`apps/api/src/modules/appointments/appointments.service.ts:545`-`:551`: ao criar o agendamento, os
três controles são resolvidos com o padrão da conta e **gravados na linha**
(`remindClient`/`notifyConfirmation`/`notifyCancellation`). Isso é bom para a recepção mudar um
horário sem mexer nos outros — mas quem envia depois nunca revalida: se o dono desligar o padrão (ou
o toggle) enquanto a mensagem está na fila, ela ainda sai.

## 60.3 — Caminhos que enfileiram sem passar por autorização

1. `apps/api/src/modules/appointments/appointments.service.ts:1106` `sendCustomerSuggestion`
   (chamado em `:1051`, pela rota `POST /appointments/:id/suggest`,
   `appointments.controller.ts:205`): só checa opt-out do cliente, com `kind: 'confirmation'`.
2. `apps/api/src/modules/public-booking/public-booking.service.ts:832` `notifyClientSuggestion`:
   idem, mesmo texto, mesmo `kind`.
3. `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:2177` (`sendAiMessage`): resposta
   da IA, `kind: 'ai'`.

Sobre (1) e (2): são **ação humana explícita** — alguém no painel clicou "sugerir outro horário".
Não é automação, e bloquear seria quebrar a feature. O que falta é a linha dizer isso, para a
revalidação da entrega (60.4) não descartar depois.

Sobre (3): a IA só responde com `AiAttendantConfig.enabled` (padrão **false**,
`packages/db/prisma/schema.prisma:2174`), `autoReply` e `handledByAi`
(`whatsapp-inbox.service.ts:1129`), e sempre **em resposta a uma mensagem que o cliente mandou** —
o que exige socket aberto. **Não vou inverter os defaults de `autoReply`/`handledByAi`**: ligar a
recepcionista virtual É a autorização, e virar esses dois para false desliga na prática uma feature
que o dono ativou de propósito. Fica registrado como decisão, não como esquecimento.

## 60.4 — Correção

Política pura, separada do transporte, para poder ser testada de verdade:

- `apps/api/src/modules/whatsapp/outbox-policy.ts` (novo):
  - `podeEnfileirar(kind, socketAberto, { autorizadaPorPessoa, doInbox })` — automação
    (`confirmation`, `cancellation`, `reminder`, `followup`, `campaign`) **não entra na fila** com o
    canal fechado. Manual, inbox/IA e envio explicitamente autorizado continuam entrando (a pessoa
    está olhando a tela e vê "na fila").
  - `expirouNaFila(kind, createdAt, agora)` — prazo de validade por tipo: lembrete 1h, confirmação
    2h, cancelamento 6h, campanha 6h, follow-up 24h.
  - `autorizacaoAindaVale({ kind, agendamento, automacao, cliente, agora })` — revalida na ENTREGA:
    agendamento sumiu/cancelado, horário já passou, padrão da conta desligado sem toggle ligado, ou
    opt-out do cliente ⇒ descarta.
- `whatsapp.service.ts`: chama as três no `enqueueText`/`deliverOutbox`; linha descartada vira
  `status: 'expired'` com `lastError` explicando (a coluna é String livre,
  `schema.prisma:2319`, então não precisa de enum novo). Cooldown padrão 60s → **5 min**.
- `packages/db/prisma/schema.prisma` + migração aditiva: `WhatsappOutbox.authorizedAt DateTime?`.
  Preenchido quando uma PESSOA autorizou aquele envio específico (botão "Enviar confirmação",
  sugestão de horário) — é o que isenta a linha da revalidação de automação.
- `apps/api/src/modules/notifications/notifications.service.ts`: trocar `isLive` por
  `canSendWhatsapp` (`queues/messaging.helpers.ts:32`) no despacho de WhatsApp — hoje, com
  `WHATSAPP_ENABLED=false` e modo live, ainda enfileirava.
- `appointments.service.ts` (envio manual e sugestão) e `public-booking.service.ts` (sugestão):
  passam `authorized: true`.
- `apps/web/src/lib/queries/confirmationMessages.ts` e
  `apps/web/src/components/AppointmentConfirmationDrawer.tsx`: status `expired` ganha rótulo
  honesto ("Expirada — não foi enviada") nos logs.
- `apps/api/src/modules/usecase-tests/outbox-policy.usecases.test.ts` (novo) +
  `run-usecases.ts`: certificação das três funções.

## 60.5 — As 9 pendentes em produção

Depois da trava no ar, as linhas presas viram `expired` (não `sent`, não apagadas), com backup em
`belasis-reference/` antes. Sem isso, a trava evita fila nova mas a antiga continua armada.
