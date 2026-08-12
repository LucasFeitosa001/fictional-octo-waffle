# Plano executável — (A) WhatsApp no agendamento online + (B) botão "Confirmar agendamento"

Verifiquei tudo abaixo lendo o código, não por memória. Caminhos absolutos a partir de `/home/lucssfeitosa/beautypass/beautypass/`.

---

## 1. DIAGNÓSTICO HONESTO DE (A)

### 1.1 "O salão é avisado" — funciona, MAS depende de um toggle que ninguém liga

Fluxo real: `apps/api/src/modules/public-booking/public-booking.service.ts:569-595`

```ts
const managerPhone = await this.whatsapp.getManagerPhone(companyId);   // :569
const salonConfirms = Boolean(managerPhone);                            // :570
...(salonConfirms ? { status: AppointmentStatus.unconfirmed } : {})     // :589
if (salonConfirms && managerPhone) { void this.sendSalonConfirmationRequest(...) }  // :593
```

E dentro de `sendSalonConfirmationRequest` (`:680-718`):
```ts
const auto = await this.settings.get(companyId);
if (!auto.notifyProfessional) return;   // :690
```

**O bug estrutural (B1, o principal):** o *status* depende só de existir o número; o *aviso* depende do toggle `notifyProfessional`, que nasce `false` (`apps/api/src/modules/notifications/notification-settings.service.ts:52-58`). Com número salvo e toggle desligado — que é a combinação de fábrica — o agendamento nasce `unconfirmed`, **ninguém no salão recebe nada**, e ele fica em limbo até o `autoConfirmStaleBookings` (`public-booking.service.ts:92-140`) confirmar sozinho: **5 dias** parado (`:39`) ou quando faltar **menos de 24h** (`:40`). A cliente, nesse intervalo, não recebe nada (é justamente suprimida — ver 1.2).

O resto do ciclo do salão está completo e correto: pedido "1/2/3" com código do agendamento (`:660`, `:693-714`), roteador de resposta `handleManagerReply` (`:724-850`) com trava de que só o número do gerente comanda (`:740`), três estratégias para achar qual agendamento (`:760-791`), ações 1=confirmar / 2=cancelar / 3=sugerir (`:805-850`), e o aviso ao profissional (`apps/api/src/modules/appointments/appointments.service.ts:1410-1419`).

UI existe e é boa: `apps/web/src/components/WhatsappConnectionCard.tsx:444-512` (campo "Número do salão"), hooks em `apps/web/src/lib/queries/whatsapp.ts:83-96` → `GET/POST /whatsapp/connection/manager` (`apps/api/src/modules/whatsapp/whatsapp.controller.ts:258-274`).

**B2 — a UI promete o que não cumpre:** `WhatsappConnectionCard.tsx:470-476` diz "*este número recebe uma mensagem no WhatsApp para confirmar…*" sem dizer que isso exige o toggle "Avisar profissionais de novos agendamentos" (`apps/web/src/pages/ConfiguracoesPage.tsx:289-295`), que está em OUTRA aba e nasce desligado. O aviso âmbar de `:503-509` cobre só o caso oposto (sem número).

### 1.2 "A cliente recebe confirmação" — o código existe inteiro; está travado por CONFIGURAÇÃO

Isto é o item 3 do pedido, e é a resposta mais importante: **não há nada para reescrever aqui.** O caminho é completo e obedece a regra permanente.

- No ato do agendamento online a mensagem à cliente é **deliberadamente suprimida** enquanto o salão não responde — `apps/api/src/modules/notifications/notifications.service.ts:129-136` (`pendingOnlineConfirmation`), com o comentário correspondente em `public-booking.service.ts:594` ("*the CLIENT is only told once the salon replies*").
- A cliente recebe quando o gerente responde `1` (ou no auto-confirm): `setStatus(confirmed)` → `apps/api/src/modules/appointments/appointments.service.ts:1276-1287` → `notifyAppointment('confirmed')` → `notifications.service.ts:151` → `dispatchClient` (`:414-419`) → outbox → revalidação na entrega (`apps/api/src/modules/whatsapp/whatsapp.service.ts:1356-1373` → `apps/api/src/modules/whatsapp/outbox-policy.ts:236`).

**As quatro travas que hoje seguram esse envio, todas de configuração:**

| # | Trava | Onde | Como destravar |
|---|---|---|---|
| 1 | `notifications.automation.confirmation = false` | `notification-settings.service.ts:53` | Configurações → Notificações → "Agendamento marcado/confirmado · WhatsApp" (`ConfiguracoesPage.tsx:266-271`) |
| 2 | `notifyProfessional = false` | idem `:57` | mesma tela; sem ele o pedido 1/2/3 não sai e o agendamento nunca chega a `confirmed` pelo caminho humano |
| 3 | `NOTIFICATIONS_MODE=live` + `WHATSAPP_ENABLED=true` | `apps/api/src/modules/queues/messaging.helpers.ts:29-33` | variáveis do App Runner — **não estão no repo**; `apps/api/.env.example:16,18` traz `dryrun`/`false` |
| 4 | Número do salão conectado + `managerPhone` salvo | `whatsapp.service.ts:606-647` | `WhatsappConnectionCard` |

Ou seja: **se o dono diz "a cliente não recebe", em 9 de 10 casos é (1)+(2) desligados, não código faltando.** Confirmar isso ANTES de tocar em qualquer linha (ver seção 6, Onda 0).

### 1.3 O que está pela metade (bugs reais, verificados)

- **B3 — o toggle "Lembrete" do agendamento não liga nada.** `apps/api/src/modules/notifications/whatsapp-reminder-poller.service.ts:192`: `const shouldSend = padraoDaConta && appointment.remindClient !== false;` — **E**, enquanto a política canônica é **OU** (`outbox-policy.ts:236`) e o processador do BullMQ faz certo (`apps/api/src/modules/queues/processors/appointment-reminders.processor.ts:109-113`). O poller é o que roda em produção (fallback ativo com `QUEUES_ENABLED=false`, `:57-64`) e ainda dá `claim` antes (`:180`), então nem sobra linha na aba Logs. O comentário `:182-184` cita uma premissa que deixou de valer.
- **B4 — `delivered`/`read` nunca são gravados no outbox**, apesar do comentário do schema (`packages/db/prisma/schema.prisma:2328`). O ACK real existe (`whatsapp.service.ts:2172-2216` → `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:912-955`) mas escreve só em `WhatsappInboxMessage`. Quem lê pelo join (`appointments.service.ts:706-721`, drawer do agendamento) mostra certo; quem lê `outbox.status` cru (`apps/api/src/modules/reports/reports.service.ts:617`, `apps/api/src/modules/customers/customers.service.ts:1049`) **nunca mostra "Entregue"/"Lida"**, e `expired` sai em inglês cru (`apps/web/src/pages/relatorios/MensagensPage.tsx:129`, `apps/web/src/pages/ClientePerfilTabs.tsx:2670`).
- **B5 — decisão de política é rotulada como falha.** O descarte grava `expired` no outbox mas `failed` no espelho (`whatsapp.service.ts:1527-1531`; recusa pré-fila em `:860-873`), e o log prefere o espelho (`appointments.service.ts:721`). O estado "Não enviada" desenhado em `apps/web/src/components/AppointmentConfirmationDrawer.tsx:79-84` **nunca aparece**; o dono lê "Falhou".
- **B6 — vazamento entre empresas (SEGURANÇA).** `reports.service.ts:570-585` casa `OR: [{ companyId }, { toPhone endsWith 8 dígitos }]` **sem AND de empresa** — mensagem de outro salão para um telefone de sufixo igual entra na tabela **com prévia do texto**. A consulta gêmea já foi corrigida em `customers.service.ts:998-1013` (`AND: [{ companyId }, …]` + defesa em `:1043`).
- **B7 — follow-up não aparece nos logs.** `appointments.service.ts:692` filtra `confirmation|cancellation|reminder`; o envio sai com `kind: 'followup'` (`apps/api/src/modules/queues/follow-up-sender.service.ts:253`), e o drawer promete o contrário em `AppointmentConfirmationDrawer.tsx:167`.

### 1.4 O que NÃO existe

- **Nenhum indicador de status de envio na grade/lista da agenda** — só dentro do drawer (`AppointmentConfirmationDrawer.tsx:443-454`).
- **A cliente não tem canal de resposta.** `handleManagerReply` (`public-booking.service.ts:740`) descarta qualquer remetente que não seja o gerente. Não existe "responda SIM para confirmar" para a cliente. Isso é desenho, não bug — mas se o dono acha que existe, não existe.
- **Filtro de status do relatório só oferece pendente/enviado/falha** (`MensagensPage.tsx:75-80`).
- **`Professional.notifyWhatsapp @default(true)`** (`packages/db/prisma/schema.prisma:810`) diverge do resto; hoje é neutralizado por `apps/api/src/auth/better-auth.ts:115`, mas outro caminho de criação nasce ligado.

---

## 2. O QUE FALTA PARA (A) FICAR COMPLETO — arquivo:linha por mudança

Nenhuma mudança abaixo remove trava, muda default para ligado, ou tira a autoridade do backend.

**M1 — coerência do estado pendente (backend)** · `apps/api/src/modules/public-booking/public-booking.service.ts:569-570`
```ts
const managerPhone = await this.whatsapp.getManagerPhone(companyId);
const auto = await this.settings.get(companyId);
const salonConfirms = Boolean(managerPhone) && auto.notifyProfessional;
```
Efeito: sem o toggle, o agendamento deixa de nascer `unconfirmed` — acaba o limbo de 5 dias em que nem salão nem cliente sabem de nada. Não cria mensagem nova por si: o caminho `created` continua gated por `auto.confirmation` (`notifications.service.ts:133-136`), default OFF. Manter a revalidação de `:690` (defesa em profundidade) ou passar o `auto` já lido.

**M2 — UI honesta sobre a dependência do toggle (frontend)** · `apps/web/src/components/WhatsappConnectionCard.tsx:468-476` e `:503-509`
Importar `useNotificationSettings` (`apps/web/src/lib/queries/notificationSettings.ts:10-17`) e, quando houver `phone` mas `notifyProfessional === false`, mostrar aviso âmbar: *"Número salvo, mas o aviso ao salão está desligado — nenhum pedido de confirmação será enviado. Ligue em Configurações → Notificações → Avisar profissionais."* com atalho para a aba (`ConfiguracoesPage.tsx:99-104`).

**M3 — corrigir a divergência do lembrete (backend)** · `apps/api/src/modules/notifications/whatsapp-reminder-poller.service.ts:192`
```ts
const shouldSend = appointment.remindClient ?? padraoDaConta;
```
Alinha com `outbox-policy.ts:236` e `appointment-reminders.processor.ts:111-113`. Atualizar o comentário obsoleto `:182-184`. **Esta é a única mudança que pode LIGAR envio que hoje não sai — ver R2.**

**M4 — status honesto do descarte (backend)** · `apps/api/src/modules/whatsapp/whatsapp.service.ts:1527-1531` e `:869`
Gravar `expired` (não `failed`) no espelho do inbox no descarte por política, e em `registrarRecusa`, mantendo o motivo em `lastError`. Só então `AppointmentConfirmationDrawer.tsx:79-84` ("Não enviada") passa a aparecer. Zero risco de disparo.

**M5 — "Entregue/Lida" fora do drawer (backend + frontend)**
- `apps/api/src/modules/reports/reports.service.ts:570-617` e `apps/api/src/modules/customers/customers.service.ts:998-1049`: incluir o join `inboxMessage` e expor `inboxMessage?.status ?? outbox.status`, copiando `appointments.service.ts:706-721`.
- Rótulos pt-BR para `read` e `expired` em `apps/web/src/pages/relatorios/MensagensPage.tsx:114-129` e `apps/web/src/pages/ClientePerfilTabs.tsx:2659-2670`; ampliar o filtro `MensagensPage.tsx:75-80`.
- Corrigir o rodapé desatualizado `MensagensPage.tsx:517-519` ("a fila é global do sistema" — não é mais, `reports.service.ts:406`).

**M6 — fechar o vazamento entre empresas (SEGURANÇA)** · `apps/api/src/modules/reports/reports.service.ts:570-585`
Trocar o `OR` solto por `AND: [{ companyId }, { OR: [...] }]`, espelhando `customers.service.ts:998-1013`.

**M7 — follow-up nos logs** · `apps/api/src/modules/appointments/appointments.service.ts:692`
Incluir `'followup'` no filtro de `kind`, cumprindo `AppointmentConfirmationDrawer.tsx:167`.

**M8 (opcional) — status de envio visível no drawer da agenda** · `apps/web/src/pages/AgendaPage.tsx:2028-2049`
Selo com o último status ao lado do bloco `AvisosDoCliente`, lendo o mesmo `confirmationSetup` já carregado por `apps/web/src/lib/queries/confirmationMessages.ts:106-119`.

**M9 (schema, com aval do dono)** · `packages/db/prisma/schema.prisma:810`
`Professional.notifyWhatsapp` → `@default(false)`, migração aditiva (memória do projeto: aplicar via `db execute` + `migrate resolve` no banco 5434, nunca `migrate dev/deploy` cego).

---

## 3. RESPOSTA DIRETA AO ITEM 3

**A notificação de WhatsApp para a cliente já existe, ponta a ponta, e está correta.** Não propor reescrita. O que a segura hoje é, nesta ordem: (1) `notifications.automation.confirmation` desligado por padrão (`notification-settings.service.ts:53`); (2) `notifyProfessional` desligado, o que impede o agendamento online de sequer chegar a `confirmed` pelo caminho humano; (3) `NOTIFICATIONS_MODE` / `WHATSAPP_ENABLED` do App Runner, que não estão no repo e precisam ser lidos antes de qualquer conclusão. O único bug de código nessa frente é B1/M1 (o limbo) e B3/M3 (lembrete). Confirmação e cancelamento estão corretos.

---

## 4. (B) BOTÃO "CONFIRMAR AGENDAMENTO" À DIREITA

**Arquivo:** `apps/web/src/pages/AgendaPage.tsx` — rodapé do drawer, wrapper em `:1801`, bloco do botão verde em `:1840-1852`.

O wrapper é `flex w-full items-center justify-between`, então "Outros" fica à esquerda e o verde à direita. Para dois botões colados à direita, envolver o bloco verde e acrescentar depois:

```jsx
{/* substitui o bloco atual de :1840-1852, mantendo-o dentro do novo div */}
<div className="flex items-center gap-2">
  {selected.order && selected.order.status !== 'canceled' ? (
    <Button variant="primary" isDisabled={createOrder.isPending}
      className="flex-1 bg-[#25a244] hover:!bg-[#1e8438] sm:flex-none"
      onClick={() => createComanda(selected)}>
      {`Acessar comanda #${selected.order.number}`}
    </Button>
  ) : can('comandas:create') ? (
    <Button variant="primary" isDisabled={createOrder.isPending}
      className="flex-1 bg-[#25a244] hover:!bg-[#1e8438] sm:flex-none"
      onClick={() => createComanda(selected)}>
      {createOrder.isPending ? 'Abrindo comanda…' : 'Abrir comanda'}
    </Button>
  ) : null}

  {can('agenda:manage')
    && (selected.status === 'unconfirmed' || selected.status === 'scheduled') && (
    <Button variant="primary" isDisabled={statusMutation.isPending}
      className="flex-1 sm:flex-none"
      onClick={() => { void changeStatus(selected, 'confirmed'); }}>
      {statusMutation.isPending ? 'Confirmando…' : 'Confirmar agendamento'}
    </Button>
  )}
</div>
```

**Tudo já está no escopo:** `can` (usado em `:1846`), `statusMutation` (`:351`), `changeStatus` (`:598-632`), `Button` importado no topo.

**Mutation/endpoint:** `useSetAppointmentStatus()` em `apps/web/src/lib/queries.ts:343-364` → `PATCH /appointments/:id/status`, `@RequirePermission('agenda:manage')` em `apps/api/src/modules/appointments/appointments.controller.ts:254-264` → `appointments.service.ts:1218` (`setStatus`). Usar o helper local `changeStatus`, não a mutation crua: ele já persiste os toggles do agendamento ANTES (`AgendaPage.tsx:606-610`), dá `flash('Agendamento confirmado.')` e joga a recusa do servidor no aviso FIXO `erroAcao` (`:625-631`) em vez de um toast que some.

**Status em que o botão faz sentido:** só `unconfirmed` e `scheduled`. Enum em `packages/db/prisma/schema.prisma:56-65`. Esconder em `confirmed` (nada a fazer), `canceled`, `waiting`, `in_progress`, `done`, `finished` (regressão de fluxo).

**Diferença crítica entre os dois status — leia antes de implementar:**
- `unconfirmed → confirmed` **DISPARA** `notifyAppointment('confirmed')` (`appointments.service.ts:1276-1287`) → a cliente pode receber WhatsApp.
- `scheduled → confirmed` **NÃO dispara** — barrado por `(event !== 'confirmed' || current.status === AppointmentStatus.unconfirmed)` em `:1278-1279`.

Portanto, em `unconfirmed` este botão é um botão que **manda mensagem para cliente real**. O mínimo aceitável é texto auxiliar honesto sob o botão quando `selected.status === 'unconfirmed'` e a automação de confirmação estiver ligada (a UI já sabe disso via `AvisosDoCliente` em `:2028-2049`): *"Ao confirmar, a cliente recebe a mensagem de confirmação no WhatsApp."* Se estiver desligada: *"A cliente não será avisada (confirmação automática desligada)."*

**Mobile:** não há rodapé separado. `apps/web/src/components/Drawer.tsx:217-224` renderiza um único `footer` (`flex flex-wrap items-center justify-end gap-2`, `sticky`, com `padding-bottom: max(0.75rem, env(safe-area-inset-bottom))`) para os dois breakpoints; o único condicional mobile do Drawer é o header (`:160-186`) e o `placement` bottom-sheet (`:61`). O botão novo **aparece automaticamente no celular** — daí o `flex-1 sm:flex-none` nos dois, padrão já usado em `apps/web/src/components/NewAppointmentModal.tsx:775-788`, para não espremer três alvos em 390px.

**Consistência:** o mesmo botão já existe no drawer irmão da página-lista, `apps/web/src/pages/AgendamentosPage.tsx:392-395` — usar o mesmo rótulo e as mesmas condições de status nos dois.

---

## 5. RISCOS — o que pode disparar mensagem indevida em produção

**R0 (bloqueante, antes de qualquer coisa).** As variáveis `NOTIFICATIONS_MODE` e `WHATSAPP_ENABLED` **não estão no repositório** (só `apps/api/.env.example:16,18`, com `dryrun`/`false`). Ler as variáveis do serviço App Runner antes de afirmar qualquer coisa sobre "sai / não sai". Se estiverem em dryrun, nada de WhatsApp sai hoje e todo o diagnóstico vira configuração.

**R1 — M1 muda o status inicial de agendamentos online.** Salão com `managerPhone` salvo + `notifyProfessional=false` + `confirmation=true` passa a mandar "agendado" à cliente **no ato**, mensagem que hoje não sai. Rodar antes, no banco de produção:
```sql
SELECT c.id, c.name FROM "Company" c
WHERE EXISTS (SELECT 1 FROM "WhatsappAuthState" w
              WHERE w."itemId"=c.id AND w.data->>'managerPhone' IS NOT NULL)
  AND (SELECT s.value FROM "Setting" s
       WHERE s."companyId"=c.id AND s.key='notifications.automation') IS NOT NULL;
```
e inspecionar o JSON de cada uma. Se qualquer empresa tiver `confirmation=true` com `notifyProfessional=false`, **não subir M1 sem falar com o dono**.

**R2 — M3 pode reativar lembretes represados.** Contar antes:
```sql
SELECT count(*) FROM "Appointment"
WHERE "remindClient" = true AND start > now() AND status IN ('scheduled','confirmed');
```
cruzando com empresas de `reminder=false`. O TTL de lembrete é 1h (`outbox-policy.ts:49-55`), então lixo velho morre na fila — mas agendamentos futuros passam a receber. Se a contagem for > 0, exigir autorização explícita.

**R3 — o botão (B) em `unconfirmed` dispara mensagem.** Duplo clique é coberto por `statusMutation.isPending` e o dedupe de 10 min (`whatsapp.service.ts:983-1019`); re-confirmar depois de desconfirmar não redispara porque `setStatus` só notifica na transição `unconfirmed → confirmed` (`appointments.service.ts:1278`). Ainda assim: esconder o botão em `confirmed` (já feito na condição acima) e não adicioná-lo à seleção múltipla.

**R4 — deploy em cima de backlog `pending`.** O reconnect drena a fila (`whatsapp.service.ts:2225-2247`). Antes de qualquer deploy que mexa em política de envio:
```sql
SELECT status, kind, count(*) FROM "WhatsappOutbox" GROUP BY 1,2;
```
Backlog `pending` grande + mudança de política = rajada. As travas de TTL (`outbox-policy.ts:126-140`) e de espera de conexão (`:108-123`) ajudam, mas não substituem olhar.

**R5 — teste real.** Regra do CLAUDE.md: nada de drenar fila de produção. Testar em salão descartável com Playwright (receita já registrada), e no máximo **um** envio controlado para o número do próprio dono, com autorização para aquele destinatário.

**R6 — o que NÃO tem risco de disparo:** M2, M4, M5, M6, M7, M8 e o botão (B) restrito a `scheduled`. São leitura, rotulagem e UI.

**R7 — M4 muda rótulos que o dono já leu.** Mensagens hoje marcadas "Falhou" viram "Não enviada" retroativamente na leitura. É a verdade, mas avisar o dono para ele não achar que sumiu algo.

---

## 6. ORDEM DE EXECUÇÃO

**Onda 0 — verificação, zero código (fazer primeiro, sempre).**
1. Ler `NOTIFICATIONS_MODE`, `WHATSAPP_ENABLED`, `QUEUES_ENABLED` no App Runner.
2. Rodar as queries de R1, R2, R4.
3. Conferir, para o salão do dono: número conectado, `managerPhone` salvo, e o estado dos 5 toggles em `Setting['notifications.automation']`. **Se `confirmation` ou `notifyProfessional` estiverem OFF, essa é a resposta ao "a cliente não recebe" — reportar isso antes de codar.**

**Onda 1 — seguro, subir primeiro (nenhuma pode disparar mensagem).**
`M6` (segurança, vazamento entre empresas — é o mais urgente do lote) → `M4` → `M5` → `M7` → `M2`.

**Onda 2 — (B), o botão.** Frontend puro. Subir depois de M2 para que o dono já veja na tela a explicação do que a confirmação dispara. Inclui o texto auxiliar de R3.

**Onda 3 — requer autorização explícita do dono, com os números de R1/R2 na mão.**
`M1` (fim do limbo) e `M3` (lembrete OU em vez de E). Subir **separadas**, uma por deploy, com a fila conferida antes e o outbox observado por ~30 min depois.

**Onda 4 — schema.** `M9` (`Professional.notifyWhatsapp` default false + migração aditiva).

**Onda 5 — opcional.** `M8` (selo de status no drawer da agenda).