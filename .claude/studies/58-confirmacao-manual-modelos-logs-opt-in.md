# Estudo 58 — Confirmação manual, modelos, logs e opt-in obrigatório

Pedido do dono:

> Ter como disparar a confirmação mesmo depois de criar o agendamento, configurar isso
> na edição, personalizar a mensagem, salvar outros padrões e ver os logs do envio.
>
> É proibido enviar automaticamente sem autorização. Só pode sair quando a empresa
> ativou o padrão para os agendamentos ou quando o envio foi autorizado especificamente
> naquele agendamento. Evitar duplicidade e mostrar se o número realmente recebeu.

## Regra de produto (não negociável)

1. O default sistêmico continua **OFF**.
2. Uma automação só pode usar `notifications.automation.confirmation=true` da empresa ou
   `Appointment.notifyConfirmation=true` do próprio horário.
3. O disparo manual exige uma confirmação explícita no request autenticado e grava
   `notifyConfirmation=true` no agendamento antes de enfileirar.
4. O opt-in do cliente (`notificationsEnabled` + `whatsappOptIn`) é uma trava adicional,
   nunca um substituto da autorização do salão.
5. “Enviado” não prova recebimento. A tela distingue fila, enviado ao servidor, entregue
   no aparelho, lido e falhou usando os ACKs já capturados pelo WhatsApp.
6. Repetição acidental é bloqueada por chave idempotente, vínculo ao agendamento e
   consulta do envio anterior. Reenvio intencional exige confirmação separada; item ainda
   pendente nunca pode ser duplicado.

## Evidência do comportamento atual

- `apps/api/src/modules/notifications/notification-settings.service.ts:35`-`:48` define
  `NOTIFICATION_AUTOMATION_DEFAULTS` com tudo `false`; o `get()` em `:159`-`:166`
  normaliza empresas sem configuração.
- `apps/api/src/modules/notifications/notifications.service.ts:90`-`:105` decide entre
  o override do agendamento e o padrão da empresa antes do envio.
- `apps/api/src/modules/appointments/appointments.service.ts:250`-`:255` resolve o
  default ao criar e `:593`-`:610` persiste overrides na edição.
- `apps/web/src/pages/AgendaPage.tsx:708`-`:762` já lê/edita os três toggles no drawer,
  e `:1893`-`:1941` os apresenta na seção Ações. Ainda não há botão de envio posterior.
- `apps/api/src/modules/whatsapp/whatsapp.service.ts:159`-`:173` possui janela de
  deduplicação/cooldown; `:759`-`:895` persiste o outbox, mas não vincula a linha ao
  agendamento nem devolve o id da fila ao chamador.
- `apps/api/src/modules/whatsapp/whatsapp.service.ts:1633`-`:1675` recebe ACKs
  `sent/delivered/read`; `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:788`-`:830`
  persiste esses estados na mensagem espelhada do inbox.
- `packages/db/prisma/schema.prisma:2303`-`:2345` guarda o outbox com status/tentativas e
  relação ao inbox, mas sem `appointmentId`/chave idempotente.
- `apps/api/src/modules/appointments/appointments.controller.ts:106`-`:178` mostra o
  padrão de escopo por empresa, RBAC e escopo profissional usado pelas novas rotas.
- `apps/api/src/modules/appointments/dto.ts:61`-`:89` e `:107`-`:125` mostram as DTOs
  validadas de criação/edição e os overrides atuais.
- `apps/api/src/modules/notifications/notifications.controller.ts:77`-`:140` mostra o
  controller de configurações por empresa e o padrão de `Setting` usado pelo follow-up.
- `apps/api/src/modules/notifications/notification-settings.service.ts:211`-`:285`
  demonstra leitura, normalização e upsert de JSON na tabela `Setting`.
- `apps/api/src/modules/notifications/notifications.service.ts:290`-`:314` é o ponto
  único que transforma confirmação automática autorizada em outbox.
- `apps/web/src/components/Drawer.tsx:37`-`:62` garante bottom-sheet no mobile; novos
  drawers aninhados devem usar o mesmo componente e `zClass` maior.
- `apps/web/src/lib/queries/notificationSettings.ts:19`-`:46` mostra o padrão React Query
  para configurações por empresa.
- `apps/api/src/modules/usecase-tests/agenda.usecases.test.ts:1`-`:20` mostra o padrão
  `node:test` das regressões da agenda; o builder de confirmação será testado ali.

## Modelo da solução

### Modelos de mensagem

Um novo `Setting` por empresa (`notifications.confirmationTemplates`) guarda modelos
customizados e o modelo padrão escolhido. O padrão carinhoso pedido pela La Belle de Jour
entra como modelo nativo, com variáveis:

- `{cliente}`
- `{quando}` (`hoje`, `amanhã` ou data por extenso)
- `{hora}` (`16 horas` / `16h30`)
- `{hora_curta}` (`16hrs` / `16h30`)
- `{servico}`
- `{estabelecimento}`

Modelos nativos não são sobrescritos; modelos customizados são limitados e normalizados.

### Envio e idempotência

`POST /appointments/:id/confirmation` exige `authorize=true` e uma `requestKey` UUID.
O backend valida tenant/permissão, telefone, opt-in do cliente, template e mensagem,
grava o opt-in do horário e só então chama o outbox. `WhatsappOutbox` ganha
`appointmentId` e `requestKey`, com unicidade por empresa/request. O envio anterior do
mesmo texto é consultado antes de criar outro.

### Logs

`GET /appointments/:id/confirmation` devolve autorização, destinatário, variáveis,
modelos e logs daquele agendamento. O status efetivo vem de `WhatsappInboxMessage`
quando houver ACK; caso contrário, cai no status do outbox. Assim “entregue” e “lido”
são evidência real do provedor, enquanto “enviado” é descrito corretamente.

## Arquivos que serão tocados (cobertura do hook)

- `AGENTS.md` (memória Codex; novo, documentação)
- `CLAUDE.md` (memória Claude; novo, documentação)
- `packages/db/prisma/schema.prisma`
  - evidência: `packages/db/prisma/schema.prisma:2303`-`:2345`
- `packages/db/prisma/migrations/20260729223000_appointment_confirmation_outbox/migration.sql`
  (novo)
  - evidência: `packages/db/prisma/migrations/20260723183554_whatsapp_outbox_context/migration.sql:1`
- `apps/api/src/modules/notifications/confirmation.templates.ts` (novo)
  - evidência: `apps/api/src/modules/queues/follow-up.templates.ts:45`-`:67`
- `apps/api/src/modules/notifications/notification-settings.service.ts`
  - evidência: `apps/api/src/modules/notifications/notification-settings.service.ts:159`-`:285`
- `apps/api/src/modules/notifications/notifications.controller.ts`
  - evidência: `apps/api/src/modules/notifications/notifications.controller.ts:77`-`:140`
- `apps/api/src/modules/notifications/notifications.service.ts`
  - evidência: `apps/api/src/modules/notifications/notifications.service.ts:90`-`:118`,
    `apps/api/src/modules/notifications/notifications.service.ts:290`-`:314`
- `apps/api/src/modules/appointments/dto.ts`
  - evidência: `apps/api/src/modules/appointments/dto.ts:61`-`:125`
- `apps/api/src/modules/appointments/appointments.controller.ts`
  - evidência: `apps/api/src/modules/appointments/appointments.controller.ts:106`-`:190`
- `apps/api/src/modules/appointments/appointments.service.ts`
  - evidência: `apps/api/src/modules/appointments/appointments.service.ts:250`-`:291`,
    `apps/api/src/modules/appointments/appointments.service.ts:593`-`:610`
- `apps/api/src/modules/whatsapp/whatsapp.service.ts`
  - evidência: `apps/api/src/modules/whatsapp/whatsapp.service.ts:759`-`:895`,
    `apps/api/src/modules/whatsapp/whatsapp.service.ts:1062`-`:1179`
- `apps/api/src/modules/usecase-tests/agenda.usecases.test.ts`
  - evidência: `apps/api/src/modules/usecase-tests/agenda.usecases.test.ts:1`-`:20`
- `apps/web/src/lib/queries/confirmationMessages.ts` (novo)
  - evidência: `apps/web/src/lib/queries/notificationSettings.ts:19`-`:46`
- `apps/web/src/components/AppointmentConfirmationDrawer.tsx` (novo)
  - evidência: `apps/web/src/components/Drawer.tsx:37`-`:62`,
    `apps/web/src/pages/AgendaPage.tsx:1893`-`:1941`
- `apps/web/src/pages/AgendaPage.tsx`
  - evidência: `apps/web/src/pages/AgendaPage.tsx:708`-`:828`,
    `apps/web/src/pages/AgendaPage.tsx:1893`-`:1941`

## Produção observada sem mutação

- A autenticação da conta `lucasfeitasa999@gmail.com` resolveu a empresa
  `DesignModa` (`companyId=cmryy21zj000hjx01lmccyco0`).
- Em 29/07/2026, `GET /notification-settings` mostrou autorização global ligada para
  confirmação, cancelamento, lembrete e aviso profissional; `followUp=false`.
- O CloudWatch mostrou QR e timeout repetido, sem `WhatsApp conectado`, então não foi
  feito envio real durante este estudo.
- Nenhuma configuração/dado de produção foi alterado.

## Implementação e validação concluídas

- O drawer de edição agora abre o editor e os logs, com bottom-sheet no mobile,
  confirmação explícita por disparo, modelo La Belle, modelos customizados e prévia.
- `GET/POST /appointments/:id/confirmation` aplicam tenant, RBAC e escopo profissional;
  o POST valida o acesso antes inclusive de responder a um retry idempotente.
- O outbox registra `appointmentId` e `requestKey`; pendência idêntica nunca é
  duplicada e um reenvio já entregue/enviado exige uma segunda confirmação.
- Os logs exibem `pending`, `sent`, `delivered`, `read` e `failed`; somente os ACKs
  `delivered`/`read` são apresentados como recebimento/leitura.
- `pnpm --filter @beautypass/db exec prisma validate`: **OK**.
- `pnpm --filter @beautypass/api typecheck`: **OK**.
- `pnpm --filter @beautypass/web typecheck`: **OK**.
- `pnpm --filter @beautypass/api build`: **OK**.
- Teste focado `UC-AGD-WA`: **6 testes, 6 aprovados, 0 falhas**.
- `pnpm --filter @beautypass/web build`: **OK** (somente o aviso preexistente de
  chunks grandes).
- Em 29/07/2026 a AWS respondeu como conta `834424012647`, o App Runner estava
  `RUNNING` e o CloudWatch continuava registrando QR/timeout da DesignModa a cada
  45 segundos, sem conexão. Por segurança, não houve pareamento, drain da fila,
  deploy ou disparo real.
