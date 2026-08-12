/**/
# Estudo 152 — botão "Confirmar agendamento" ao lado do de faturar

Pedido do dono:

> "veja de botar um botão do lado direito de faturar com confirmar agendamento"

## Arquivos tocados

- `apps/web/src/pages/AgendaPage.tsx`

## Onde estava o buraco

O rodapé do drawer (`AgendaPage.tsx:1800-1853`) tem "Outros" à esquerda e o
botão verde de comanda à direita — o "faturar" do pedido. Confirmar um
agendamento, porém, **não tinha botão nenhum**: só dava para mudar o status por
caminhos indiretos. Para um pedido vindo do agendamento online, que nasce
`unconfirmed`, confirmar é a ação mais frequente do dia — e era a mais
escondida.

## O que o botão faz

`changeStatus(selected, 'confirmed')` — o helper local (`:598-632`), não a
mutation crua. Ele já persiste os toggles do agendamento ANTES de mudar o
status (`:606-610`), o que evita confirmar usando o valor antigo do banco, e
joga a recusa do servidor no aviso FIXO `erroAcao` em vez de um toast que some
em 0,3s (estudo 138).

Só aparece em `unconfirmed` e `scheduled`. Nos demais não haveria o que fazer
(`confirmed`) ou seria regressão de fluxo (`canceled`, `waiting`,
`in_progress`, `done`, `finished`).

## O cuidado que este botão exige

`unconfirmed → confirmed` **dispara mensagem para a cliente**;
`scheduled → confirmed` não. A regra está em
`appointments.service.ts:1276-1279`:

```ts
(event !== 'confirmed' || current.status === AppointmentStatus.unconfirmed)
```

Ou seja: em um pedido do agendamento online, este botão é um botão que **manda
WhatsApp para uma pessoa real**. Um botão assim não pode mentir sobre o que faz.

Por isso ele mostra, embaixo, o que vai acontecer — usando o estado que o
próprio drawer já mantém (`sendConfirmation`, ligado ao toggle
`notifyConfirmation` do bloco "Mensagens para o cliente", `:2028`):

- toggle ligado → "A cliente recebe a confirmação no WhatsApp."
- toggle desligado → "A cliente não será avisada (aviso desligado neste agendamento)."

A frase só aparece quando o envio é possível (`unconfirmed`), senão seria ruído
— em `scheduled` nada sai, independentemente do toggle.

Isso mantém a regra permanente do projeto: quem dispara continua sendo o
backend, com as travas dele; a interface apenas para de esconder o efeito.

## Layout

O botão verde e o novo ficam num `div` com `gap-2` dentro do rodapé, que já é
`justify-between` — assim os dois ficam colados à direita, na ordem pedida
(confirmar à direita do de faturar), e "Outros" segue à esquerda.
