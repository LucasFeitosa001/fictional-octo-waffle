# Estudo 123 — o sino do painel mostrava o recado pessoal da cliente

Pedido do dono: *"quando eu crio um agendamento online, as notificação não
precisa ser assim, coloca da mesma forma como é os outros"* — com print do sino
mostrando:

> **Agendamento confirmado**
> Olá, Lucas Feitosa! Seu Manicure com Bruna Lima está confirmado para
> terça-feira, 04/08, 16:15 (até 16:30) no DesignModa. Até lá! 💕

## Não é formatação — é a notificação errada

Um agendamento cria DUAS linhas em `Notification`, com o mesmo `companyId`:

- apps/api/src/modules/notifications/notifications.service.ts:174 — a do
  **salão**, `userId` ausente (nulo), corpo `messages.studio.body`;
- :195 — a da **cliente**, dentro de `if (appt.customer?.userId)`, com
  `userId: appt.customer.userId` e corpo `messages.client.body`.

Os dois textos saem de `composeAppointmentMessages`
(apps/api/src/modules/notifications/notifications.templates.ts:88-98):

```
studio: { title: `Agendamento ${label}: ${client}`,
          body:  `${services} com ${prof} em ${when} (até ${endTime}).` }
client: { title: `Agendamento ${label}`,
          body:  clientLine }        // "Olá, …! Seu … Até lá! 💕"  (:75)
```

O print tem o título SEM o `: Nome` e o corpo com "Olá,… 💕" — é o par da
CLIENTE, não o do salão. O formato "igual aos outros" que o dono quer já existe;
só não era ele que estava chegando ao sino.

## Por que vazava

Todas as leituras do painel filtravam apenas por `companyId`, sem excluir as
linhas com `userId`:

- notifications.service.ts:230 — `listForCompany` (`where` e `countWhere`)
- :257 — `summaryByType` (os dois `groupBy`)
- :277 — `unreadCount`
- :286 — `markRead`
- :300 — `markAllRead`

Grep confirma: `userId` só aparecia na CRIAÇÃO (:194, :198) e no tipo
`NotificationRow` (:30) — nenhuma consulta do painel o usava.

O lado da cliente sempre esteve certo:
apps/api/src/modules/public-booking/public-booking.service.ts:1015 usa
`{ companyId, userId: user.id }`, e o mesmo em :1040 e :1049. Ou seja, a linha
da cliente aparecia nos DOIS lugares — no portal dela (correto) e no sino do
salão (o bug).

Aparecia só no agendamento **online** porque é o único fluxo em que a cliente
tem conta (`customer.userId`); pelo painel, o `if` da :194 nem dispara.

## Confirmado no banco

Consulta em `Notification` (banco local :5434, cópia de produção):

```
userId nulo (sino do salão)   → "Agendamento confirmado: ADRIANA RODRIGUES"
                                 "ADIANTAMENTO MECHAS com ESHILEY … em sexta-fe…"
userId preenchido (19 linhas) → "Agendamento confirmado"
                                 "Olá, Paulo de Tasso Oliveira de Lacerda! Seu …"
```

Nenhuma linha de salão tem "Olá," no corpo; todas as 19 da cliente têm.

## O que este estudo muda

**Arquivos tocados**

- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/usecase-tests/notificacoes-sino.usecases.test.ts` (novo)
- `apps/api/src/modules/usecase-tests/run-usecases.ts`

Um helper `DO_SALAO(companyId) = { companyId, userId: null }` passa a ser o
`where` das cinco consultas do painel. Sem tabela nova e sem migração: a coluna
já existe e já é gravada certo — faltava lê-la.

São cinco e não uma porque cada uma tem uma consequência própria: a lista traz o
texto errado, `unreadCount` acende a bolinha por uma notificação que não é do
salão, `summaryByType` infla a categoria, e as duas de marcar-como-lida deixam o
painel apagar o aviso do feed da CLIENTE — este último é o pior, porque some com
algo que ela ainda não viu.

O teste novo (7 casos) monta um prisma falso que aplica o `where` de verdade
sobre duas linhas — uma de cada dono. Um mock de lista fixa passaria mesmo com o
filtro removido; é o `where` que está sob teste.
