# Estudo 61 — Personalização das mensagens de WhatsApp (confirmação, cancelamento, lembretes)

Pedido do dono, depois do conserto do estudo 59: **"Tem que ter personalizacao"**.

Hoje só DUAS das cinco mensagens automáticas do cliente têm texto editável, e uma delas edita algo
que o automático nem usa. Levantamento arquivo:linha:

| mensagem | texto de hoje | editável? |
|---|---|---|
| confirmação (marcado/confirmado) | `notifications.templates.ts:73` (linha fixa `clientLine`) | **não** — o modelo editável só vale no envio manual |
| cancelamento | `notifications.templates.ts:72` (mesma `clientLine`, ramo `canceled`) | **não** — não existe chave, endpoint nem tela |
| lembrete 24h | `queues/reminder.templates.ts:58` | **não** |
| lembrete 2h | `queues/reminder.templates.ts:62` | **não** |
| follow-up | `Setting notifications.followUp` | sim (Configurações → Notificações) |

## 61.1 — O que já existe e vai ser reaproveitado

`apps/api/src/modules/notifications/confirmation.templates.ts` tem a máquina completa:

- chave `notifications.confirmationTemplates` (`:1`-`:2`);
- variáveis `{cliente} {quando} {hora} {hora_curta} {servico} {estabelecimento}` (`:4`-`:11`);
- embutido da La Belle (`:42`-`:56`);
- `confirmationTemplateVariables()` (`:128`), `renderConfirmationTemplate()` (`:144`),
  `unresolvedConfirmationVariables()` (`:158`).

`apps/api/src/modules/notifications/notification-settings.service.ts` guarda/lê com merge dos
embutidos por cima dos customizados: `getConfirmationTemplates` (`:311`), `updateConfirmationTemplates`
(`:348`), `normalizeConfirmationTemplates` (privado, no fim do arquivo). JSON velho/corrompido nunca
apaga o padrão seguro.

`apps/api/src/modules/notifications/notifications.controller.ts` expõe hoje
`GET confirmation-templates` (`:122`) e `PUT confirmation-templates` (`:130`), com validação de id
(`custom-…`), rótulo ≤80, mensagem ≤2000 e variável desconhecida (`:148`-`:175`).

Quem consome no front: `apps/web/src/lib/queries/confirmationMessages.ts:109`
(`useSaveConfirmationTemplates`) → só dentro de
`apps/web/src/components/AppointmentConfirmationDrawer.tsx` (o drawer "Confirmação por WhatsApp"),
que grava o padrão da empresa em `:242` e `:262`. Nas Configurações não há **nenhum** editor: o único
card de texto é o do follow-up (`ConfiguracoesPage.tsx:455` `FollowUpConfigCard`).

## 61.2 — Os dois furos, medidos

1. **O aviso AUTOMÁTICO ignora o modelo.** `notifications.service.ts:71` monta o texto com
   `composeAppointmentMessages`, e é esse texto que vai pro WhatsApp em `:311`. O modelo editável
   não é lido em nenhum ponto desse caminho (`grep getConfirmationTemplates` só acha
   `appointments.service.ts:208` e `:303`, ambos do fluxo manual). Ou seja: o dono edita e o
   automático continua com a linha fixa.
2. **Cancelamento e lembretes não têm modelo nenhum.** Nem chave de `Setting`, nem endpoint, nem
   tela. Os textos são as linhas fixas citadas na tabela acima.

## 61.3 — Correção

Um kit genérico por *tipo de mensagem*, para não repetir a mecânica quatro vezes:

- `apps/api/src/modules/notifications/message-templates.ts` (novo): tipo `MessageTemplateKind`
  (`confirmation` | `cancellation` | `reminder24h` | `reminder2h`), registro com chave de `Setting`,
  variáveis permitidas, embutidos e padrão de cada tipo, e `renderMessageTemplate()` — que além de
  substituir, **apaga a linha inteira quando a variável está vazia** (é como `{motivo}` desaparece
  quando o cancelamento não tem motivo).
- `apps/api/src/modules/notifications/confirmation.templates.ts`: ganha `{profissional}` na lista de
  variáveis e em `confirmationTemplateVariables` (os lembretes citam o profissional — sem essa
  variável o texto embutido de hoje não seria reproduzível). Variável nova é retrocompatível:
  modelo antigo simplesmente não a usa.
- `apps/api/src/modules/notifications/cancellation.templates.ts`: ganha `{motivo}` (o texto fixo de
  hoje inclui "Motivo: …" quando o cancelamento tem motivo — `notifications.templates.ts:72`).
- `apps/api/src/modules/notifications/notification-settings.service.ts`: `getTemplates(companyId,
  kind)` / `updateTemplates(companyId, kind, input)` genéricos + `activeTemplateMessage(companyId,
  kind)`; os métodos de confirmação/cancelamento passam a delegar (mesma resposta de hoje).
- `apps/api/src/modules/notifications/notifications.controller.ts`:
  `GET/PUT /notification-settings/message-templates/:kind`. As rotas
  `confirmation-templates` continuam (o drawer usa) e reaproveitam a mesma validação.
- `apps/api/src/modules/notifications/notifications.service.ts`: antes de despachar, o texto do
  WhatsApp do cliente passa a ser o modelo padrão da empresa renderizado — `confirmation` para
  `created`/`confirmed`, `cancellation` para `canceled`. Se não houver modelo utilizável ou der
  qualquer erro, **mantém o texto fixo** (nunca fica sem mensagem).
- `apps/api/src/modules/queues/reminder.templates.ts`: `composeReminderMessage` aceita um
  `template` opcional; sem template, texto fixo de hoje.
- `apps/api/src/modules/queues/processors/appointment-reminders.processor.ts` (`:88`) e
  `apps/api/src/modules/notifications/whatsapp-reminder-poller.service.ts` (`:181`): leem o modelo
  ativo da empresa e passam para o composer. Nenhuma trava de envio é tocada — só o texto.
- `apps/api/src/modules/appointments/appointments.service.ts` (`:211`, `:325`): as variáveis do
  preview/manual ganham `professionalName` (o `loadConfirmationAppointment` já traz o profissional).

Certificação:

- `apps/api/src/modules/usecase-tests/message-templates.usecases.test.ts` (novo) e
  `apps/api/src/modules/usecase-tests/run-usecases.ts` (registro): travam o modelo no automático, o
  fallback para o texto fixo quando o modelo falta/quebra/estoura 2000, `{motivo}` presente e
  ausente, chave de `Setting` por tipo, e — o mais importante — que **modelo não autoriza envio**
  (sem padrão da conta e sem toggle do agendamento, nada é enfileirado).
- `apps/api/src/modules/usecase-tests/agenda.usecases.test.ts:281`: passa a informar
  `professionalName` (a variável nova é obrigatória no dado de entrada).

Front:

- `apps/web/src/lib/queries/messageTemplates.ts` (novo): hooks genéricos por tipo + catálogo de
  variáveis com exemplo + preview local.
- `apps/web/src/components/MessageTemplatesCard.tsx` (novo): card "Modelos de mensagem" com os
  quatro tipos, seletor de modelo, editor com chips de variável, preview, salvar como novo modelo,
  definir padrão e excluir modelo customizado. Somente leitura sem `config:manage`.
- `apps/web/src/pages/ConfiguracoesPage.tsx`: renderiza o card na aba Notificações, abaixo de
  "Notificações automáticas".
- `apps/web/src/lib/queries/confirmationMessages.ts`: `ConfirmationVariables` ganha `profissional`
  (o backend passa a devolver).

## 61.4 — O que NÃO muda (de propósito)

- **Autorização de envio.** Modelo de texto não liga automação: continua valendo a regra do estudo
  59/memória — padrão da conta OU toggle do agendamento. Nenhuma linha de gating é tocada aqui.
- **E-mail e sino.** O texto personalizado vale para o WhatsApp do cliente, que é o canal reclamado.
  O e-mail do cliente e o aviso interno seguem com o texto composto de hoje.
- **A fila.** As travas do estudo 60 (não enfileirar desconectado, TTL, revalidar na entrega) seguem
  pendentes — são o próximo passo, independente disto.
