# Estudo 116 — a notificação do sino chega atrasada

Relato do dono: o aviso `IA · Agendamento cancelado: Paulo / Corte masculino de
cabelo com Lucas Feitosa em quarta-feira, 05/08, 09:00 (até 09:15).` **demora
para chegar** ao painel, mesmo com o painel aberto.

## Arquivos tocados

- `apps/web/src/lib/queries/notificacoes.ts`

## Evidência lida

### O texto do relato é o do sino, e o backend o grava na hora

- apps/api/src/modules/notifications/notifications.templates.ts:88-90 —
  `studio.title = "Agendamento ${label}: ${client}"` e
  `studio.body = "${services} com ${prof} em ${when} (até ${endTime})."`. É
  exatamente o formato do relato.
- apps/api/src/modules/notifications/notifications.service.ts:169-172 — o
  prefixo `IA · ` sai de `appt.legacySource === 'voltr-ia'`.
- apps/api/src/modules/notifications/notifications.service.ts:174-182 — a linha
  em `Notification` é criada aqui, com `entityId = appointmentId`.
- apps/api/src/modules/voltr/voltr-agenda.service.ts:713-716 — o cancelamento da
  IA chama `appointments.setStatus(... 'canceled' ...)`.
- apps/api/src/modules/appointments/appointments.service.ts:1286 —
  `void this.notifications.notifyAppointment(event, companyId, id, ...)`. O
  `void` é fire-and-forget: **não há fila nem espera** entre cancelar e gravar a
  notificação. O atraso NÃO está no servidor.

### O atraso está no cliente: o polling para com a aba em segundo plano

- apps/web/src/lib/queries/notificacoes.ts:78-83 — `useNotifications` com
  `refetchInterval: 30_000` e nada além disso.
- apps/web/src/main.tsx:91 — `refetchOnWindowFocus: false` GLOBAL, com a
  justificativa (boa para o resto do app) de que voltar à aba não deve refazer
  todas as queries montadas.
- Documentação do TanStack Query v5 (`reference/useQuery`), sobre
  `refetchIntervalInBackground`: *"If set to `true`, queries that are set to
  continuously refetch with a `refetchInterval` will continue to refetch while
  their tab/window is in the background"* — ou seja, com o padrão (`false`) o
  polling **para** fora do primeiro plano. A versão em uso é `^5.62.0`
  (apps/web/package.json:21).

Somando os dois: com a aba do painel em segundo plano — que é como ela passa o
dia no salão — o `refetchInterval` fica parado, e ao voltar para a aba o
`refetchOnWindowFocus: false` impede a recuperação imediata. O aviso só aparece
no próximo tique depois de a aba voltar ao primeiro plano.

### Achado colateral: `useUnreadCount` não tem nenhum consumidor

- apps/web/src/lib/queries/notificacoes.ts:86-92 — o hook existe e faz polling
  de `/notifications/unread-count`.
- apps/api/src/modules/notifications/notifications.controller.ts:52-55 — a rota
  existe.
- `grep -rn "useUnreadCount" apps/web/src` → **nenhuma ocorrência** fora da
  própria definição.
- apps/web/src/components/NotificationBell.tsx:86-87 — o badge vem de
  `notifications.data?.unreadCount`, ou seja, da lista completa
  (`useNotifications(30)`, :82). É essa a única query que importa para o atraso.

Rota e hook prontos sem consumidor: o padrão "grava e ninguém consome" descrito
em `features-decorativas-salonpass`. Fica registrado; a correção mantém o hook
coerente com o do sino para que, se alguém o ligar, já nasça certo.

### O que NÃO existe (e por isso não é a causa)

- `grep -rn "socket|EventSource|SSE|websocket"` em `queries/notificacoes.ts` e
  em `apps/web/src/layout/*.tsx` → vazio. Não há realtime no painel; o sino é
  100% polling.
- `grep -rln "web-push|PushSubscription" apps/api/src` → vazio. O SalonPass não
  manda push nativo (a Voltr tem `PushService`, o SalonPass não).

## O que este estudo muda

Em `apps/web/src/lib/queries/notificacoes.ts`, e SÓ nas queries de notificação:

- `refetchIntervalInBackground: true` — o sino continua contando com a aba em
  segundo plano, que é justamente quando o aviso importa;
- `refetchOnWindowFocus: true` — exceção local ao `false` global do main.tsx,
  para que voltar à aba mostre na hora o que chegou.

A exceção vale só para notificação: é o dado cuja utilidade depende de chegar
rápido, são duas queries pequenas, e o sino não desloca conteúdo da página (o
risco de "layout tremendo" que motivou o padrão global não se aplica).

**Limite honesto:** isto reduz o atraso ao intervalo de polling, não o elimina.
Entrega instantânea exigiria push nativo ou um canal realtime no painel —
nenhum dos dois existe hoje, e ambos são trabalho maior que este estudo.
