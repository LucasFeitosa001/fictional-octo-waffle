# Estudo 137 — "unconfirmed" em inglês no cartão de agendamento da cliente

Captura do dono em `agenda.salonpass.com.br/labelledejour/conta`: no bloco
**Meus agendamentos**, o selo do agendamento mostra **`unconfirmed`** — o valor
cru do banco, em inglês, na tela de quem marcou o horário.

## Arquivos tocados

- `apps/web-club/src/lib/format.ts`

## O que o código faz hoje

`apps/web-club/src/lib/format.ts:47-60`:

```ts
const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  arrived: 'Chegou',
  in_progress: 'Em atendimento',
  done: 'Concluído',
  finished: 'Finalizado',
  canceled: 'Cancelado',
  no_show: 'Não compareceu',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
```

Quem chama: só `apps/web-club/src/pages/AccountPage.tsx:334`, dentro do selo do
cartão (`:327-335`), importado em `:25`.

## Por que vaza

O enum real tem OITO valores
(`packages/db/prisma/schema.prisma:56-65`, espelhado em
`packages/shared/src/enums.ts:3-13`):

```
scheduled  confirmed  unconfirmed  waiting  in_progress  done  finished  canceled
```

O mapa cobre 6 deles e **não tem `unconfirmed` nem `waiting`**. Como o fallback
é `?? status`, o valor cru aparece na tela. Dois problemas de uma vez:

- o mapa é `Record<string, string>`, então o TS nunca cobrou a falta;
- ele ainda carrega `arrived` e `no_show`, que **não existem** no enum — rótulos
  órfãos que nunca vão aparecer.

`unconfirmed` não é caso raro: é o estado NORMAL de quem agenda pelo portal
quando o salão confirma primeiro — `public-booking.service.ts:589`
(`...(salonConfirms ? { status: AppointmentStatus.unconfirmed } : {})`) e
`:668`. Ou seja, a maioria dos agendamentos online nasce assim e a cliente lê
"unconfirmed".

## Que palavra usar

O painel já traduz tudo em `apps/web/src/pages/ClientePerfilTabs.tsx:1491-1500`,
e lá `unconfirmed` é **"Não confirmado"** — correto para quem opera o salão.

Aqui quem lê é a CLIENTE, e para ela "Não confirmado" soa como problema. O que
de fato acontece está descrito em
`apps/api/src/modules/notifications/notifications.service.ts:126-132`: *"Pedido
online que ainda aguarda o salão"* — a mensagem só sai quando virar `confirmed`.
Por isso o texto do portal é **"Aguardando confirmação"**: mesma verdade, dita
para o outro lado do balcão.

## A correção

Mapa tipado como `Record<AppointmentStatus, string>`, usando o enum do
`@beautypass/shared`. Assim o TypeScript **exige** uma frase para cada status, e
um valor novo passa a quebrar o build em vez de vazar cru na tela — que é a
única forma de isto não voltar a acontecer.

O fallback deixa de ecoar o valor cru: status fora do enum é defeito de dado, e
mostrar "unconfirmed" para a cliente é pior do que não mostrar selo nenhum.
