/**/
# Estudo 153 — aviso de WhatsApp próprio para o agendamento online

Pedido do dono:

> "É simplesmente botar um negócio pra ativar isso de avisar no whatsapp ou
> não, especificadamente pra agendamentos online e botar isso em configurações,
> e deixar ativado"

## Arquivos tocados

- `apps/api/src/modules/notifications/notification-settings.service.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/public-booking/public-booking.service.ts`
- `apps/web/src/pages/ConfiguracoesPage.tsx`
- `apps/web/src/lib/queries/notificationSettings.ts`

## O que estava acontecendo (e é pior do que "não avisa")

A cliente que agendava pela internet não recebia nada. Mas o motivo não era um
toggle desligado — eram DOIS defeitos somados:

**1. O status prometia uma resposta que ninguém ia dar.**
`public-booking.service.ts:569-570` decidia o status só por existir o número do
gerente:

```ts
const salonConfirms = Boolean(managerPhone);
…(salonConfirms ? { status: AppointmentStatus.unconfirmed } : {})
```

Só que o pedido "1/2/3" ao gerente depende do toggle `notifyProfessional`
(`:690`), que nascia **desligado**. Na combinação de fábrica — número salvo,
toggle desligado — o agendamento nascia `unconfirmed`, **ninguém no salão era
avisado**, e ele ficava esperando uma resposta que nunca viria.

**2. E a cliente era silenciada justamente nesse intervalo.**
`notifications.service.ts:129-136` suprime o aviso enquanto o pedido online está
`unconfirmed` — o que é correto quando o salão vai mesmo responder, e cruel
quando ninguém foi avisado. O agendamento só saía do limbo pelo
`autoConfirmStaleBookings`: **5 dias** parado, ou quando faltasse menos de 24h.

Ou seja: a cliente agendava, não recebia nada, e o salão também não. Ninguém
sabia de nada por até cinco dias.

## A correção

**Chave própria `onlineBooking`, ligada por padrão.** É a única automação do
sistema que nasce ligada, o que contraria a regra geral do projeto ("toda
automação nasce desligada") — decisão explícita do dono. O motivo de ser segura
é temporal: ela decide sobre um agendamento que está sendo criado *naquele
instante*. Não existe fila acumulada para drenar quando alguém liga o toggle,
ao contrário de lembrete e follow-up, que varrem agendamentos já existentes.

As demais travas continuam de pé: transporte `live`, número conectado, opt-in
do cliente, e o toggle do agendamento específico — que segue tendo a última
palavra (`appointmentOverride ?? padraoDaConta`).

**O status passou a refletir o que vai acontecer de verdade**
(`public-booking.service.ts`): `unconfirmed` só quando o pedido ao salão vai
mesmo sair. Sem isso, o agendamento nasce `scheduled` e a cliente recebe a
confirmação normalmente — fim do limbo.

**O gate do envio à cliente separa os dois casos** (`notifications.service.ts`):
pedido `online` obedece a `onlineBooking`; agendamento marcado na recepção
continua em `confirmation`. São situações diferentes — quem foi ao balcão ouviu
"tá marcado" de uma pessoa; quem agendou às 23h do celular não ouviu nada.

**Ausente = ligado** no `normalize`. Isso vale também para quem já tem a linha
gravada sem a chave: o salão que configurou notificações antes desta versão
passa a ter o aviso do agendamento online ligado, que é o comportamento pedido.
Só fica desligado para quem desligar de propósito.

## O que NÃO mudou

Nada foi disparado retroativamente e nenhuma fila foi drenada. A mudança só
afeta agendamentos criados a partir de agora.
