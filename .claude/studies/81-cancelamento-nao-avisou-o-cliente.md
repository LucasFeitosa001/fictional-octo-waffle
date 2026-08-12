# Estudo 81 — O cancelamento não avisou o cliente, e o "ou" virou "e"

Relato do dono: cancelou um agendamento com "Mensagens para o cliente · WhatsApp → Cancelamento"
LIGADO e nada chegou ao cliente. *"me diga qual o critério para enviar?"*

## 81.1 — A prova em produção

A mensagem existiu. `WhatsappOutbox` da DesignModa, hoje:

```
15:34:46 | cancellation | expired | "O horário já passou"
         | "Olá, Paulo! Seu horário de Cabelos hoje às 15h30 foi cancela…"
```

`Appointment.start` = 15:30, cancelado ~15:34. `notifyCancellation = true` na linha — o toggle do
dono estava certo. O texto foi montado, a linha nasceu e o portão de entrega a descartou.

Na mesma tabela, o segundo bloqueio, independente:

```
16:13:07 | confirmation | expired | "Aviso desligado (no agendamento ou no padrão da conta)"
```

Esse era de um agendamento das **17:00** (futuro) com `notifyConfirmation = true`. O único jeito de
barrar era o padrão da conta — e `Setting notifications.automation` da DesignModa foi gravado às
16:12:39, 28 s antes, com `cancellation/confirmation/reminder: false`.

Ou seja: **o interruptor do agendamento hoje só consegue desligar, nunca ligar.**

## 81.2 — Furo 1: "o horário já passou" não vale para cancelamento

`apps/api/src/modules/whatsapp/outbox-policy.ts:164`:

```
if (agendamento.start.getTime() <= agora.getTime()) {
  return { ok: false, motivo: 'O horário já passou' };
}
```

Escrevi isso no estudo 77 para o LEMBRETE — o caso real era "lembrete chegando depois do
atendimento". Apliquei aos três tipos de uma vez, e para cancelamento está errado: cancelar horário
que já começou é rotina (cliente que não veio, atendimento que caiu em cima da hora) e é exatamente
quando o aviso importa. Confirmação também não deve sair para horário vencido; só o cancelamento sai
da regra.

## 81.3 — Furo 2: eu troquei o "ou" da regra do projeto por um "e"

CLAUDE.md, regra permanente:

> Uma confirmação só pode sair se a empresa ativou o padrão da conta **ou** se o envio foi
> autorizado especificamente naquele agendamento.

`outbox-policy.ts:185` hoje: `const permitido = padraoDaConta && doAgendamento !== false;` — **e**.

Foi mudança minha no estudo 77, e o motivo era legítimo: `appointments.service.ts:551`-`:555`
CONGELA o padrão da conta dentro do agendamento na criação, então o campo nunca nascia NULL e
desligar a conta não alcançava nada já criado (o dono desligou 13:27, saiu lembrete 13:30).

Mas eu tratei o sintoma. `doAgendamento = true` não significava "uma pessoa autorizou": significava
"o padrão da conta era true quando isto foi criado". Com o congelamento no lugar, nenhuma das duas
leituras funciona.

## 81.4 — A correção é acabar com o congelamento

Com o campo nascendo NULL quando ninguém tocou nele, o `??` volta a significar o que a regra diz:

| `notifyCancellation` | significado | decide |
| --- | --- | --- |
| `null` | ninguém mexeu | o padrão da conta, lido **na hora da entrega** |
| `true` | uma pessoa autorizou este agendamento | envia, mesmo com a conta desligada |
| `false` | uma pessoa vetou este agendamento | não envia, mesmo com a conta ligada |

Isso resolve o incidente do estudo 77 melhor que o veto: desligar a conta passa a alcançar todo
agendamento que ninguém autorizou individualmente — inclusive os já criados —, porque não existe mais
cópia congelada para atrapalhar.

Metade do trabalho já está feita e certa: o visualizador em `apps/web/src/pages/AgendaPage.tsx:853`
-`:858` só manda o campo quando a pessoa tocou no toggle (`cancellationTouched`). Falta o modal de
criação, que tem os refs (`NewAppointmentModal.tsx:242`-`:256`) mas ignora-os no payload (`:515`
-`:517`), mandando os três sempre.

## 81.5 — Correção

1. `outbox-policy.ts:164` — a checagem de horário vencido deixa de valer para `cancellation`.
2. `outbox-policy.ts:185` — volta a `doAgendamento ?? padraoDaConta`.
3. `appointments.service.ts:551`-`:555` e `:688`-`:692` (série) — parar de congelar: grava
   `dto.X ?? null`.
4. `NewAppointmentModal.tsx:515`-`:517` — só enviar o campo que foi tocado, como o visualizador já faz.

O que **não** muda: automação continua desligada por padrão (os três defaults são `false` em
`notification-settings.service.ts:53`-`:55`); o opt-in do cliente (`:143`) segue como trava adicional
que sozinha nunca autoriza; e nada é enviado sem passar pelo portão.

Certificação em `outbox-policy.usecases.test.ts`: cancelamento de horário já passado SAI; lembrete e
confirmação de horário passado NÃO saem; conta desligada + agendamento `true` SAI; conta desligada +
agendamento `null` NÃO sai; conta ligada + agendamento `false` NÃO sai.
