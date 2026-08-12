# Estudo 128 — sino do painel sem PermissionGuard

Pedido do dono: cobertura crítica. A auditoria de 05/08 marcou o
`NotificationsController` como ALTO — só tinha `@UseGuards(JwtAuthGuard)`.

## O furo

`apps/api/src/modules/notifications/notifications.controller.ts:30` — o
`@Controller('notifications')` estava anotado apenas com `JwtAuthGuard`.
Consequência:

- Qualquer usuário logado da empresa lia `/notifications`, `/notifications/summary`,
  `/notifications/unread-count`;
- Um profissional com `agenda:view_own` (só a própria agenda) via a lista
  inteira do sino (agendamentos de outros profissionais, follow-ups da
  automação, tudo);
- Pior: **`POST /notifications/read-all`** marcava tudo como lido para a
  empresa inteira. Um profissional apagando por engano o feed do dono do
  salão.

O isolamento por `companyId` mantinha a barreira entre empresas — mas dentro do
salão não havia separação por papel.

## O que este estudo muda

`apps/api/src/modules/notifications/notifications.controller.ts`:

- `@UseGuards(JwtAuthGuard, PermissionGuard)` no controller;
- LER (`GET`) exige uma das keys de visão administrativa:
  `agenda:view` / `agenda:view_all` / `config:view` / `config:manage`. Um
  profissional com só `agenda:view_own` recebe 403;
- MARCAR (`POST /:id/read` e `/read-all`) exige gestão:
  `agenda:manage` OU `config:manage`. Alterar estado que outros veem é decisão
  administrativa, não de operador.

## Arquivos tocados

- `apps/api/src/modules/notifications/notifications.controller.ts` — o
  controller do sino recebe as guardas e os decorators;
- `apps/api/src/modules/usecase-tests/notificacoes-permissao.usecases.test.ts`
  (novo) — testa o `PermissionGuard.canActivate` para os 6 cenários que
  importam.

## Nota sobre o outro controller do arquivo

O `NotificationSettingsController` (mesma pasta, mais abaixo) já tinha
permissão apropriada — configurar automação é `config:manage`. Não muda.
