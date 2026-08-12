# Estudo 77 — O lembrete de 24h não espera 24h, e o interruptor da conta não veta

Mapeamento dos 7 gatilhos de disparo automático (7 mapeadores + 7 céticos). Três furos sobreviveram
à crítica, e os três estão confirmados com dados de produção.

## 77.1 — O "lembrete de 24h" sai no ato

**Caminho do BullMQ.** `apps/api/src/modules/queues/queues.service.ts:136`:

```
const delay = Math.max(0, fireAt - now);
```

`fireAt` é `start − 24h`. Para um agendamento marcado para daqui a 4 horas, esse instante já ficou
20 h no passado — o `Math.max` grampeia em 0 e o job dispara **imediatamente**, com o texto
"…amanhã…". A única guarda (`:135`) é `if (startMs <= now) continue`, que só pula agendamento já
começado.

**Caminho do poller.** `apps/api/src/modules/notifications/whatsapp-reminder-poller.service.ts:111`
-`:113` seleciona `start > agora AND start <= agora + 24h` — ou seja, **qualquer** agendamento das
próximas 24 h é candidato — e `dueKind` (`:152`-`:155`) escolhe o tipo só pelo tempo restante. Em
nenhum dos dois caminhos existe comparação com o instante em que o lembrete **deveria** sair.

**Prova em produção.** Agendamento `cmrzdt6mu001qld01o8ymgefb`: criado 24/07 20:17:25.974, start
20:30 — treze minutos depois. Os dois marcadores dispararam: `reminder_24h` em 20:17:26.036 e
`reminder_2h` em 20:17:26.066. **60 ms e 90 ms após a criação**, duas mensagens de uma vez, dizendo
"amanhã".

E segue vivo: `cms90se1h004ylg0143yec2l2`, criado hoje 14:10:35 para as 18:30, já nasceu com
marcador `reminder_24h`. Só não saiu mensagem porque o `remindClient` estava `false` — o gatilho
disparou; quem segurou foi o dado, não a trava.

## 77.2 — O interruptor da conta não veta

`appointments.service.ts:551` (e `:688`, na série) copia o padrão da conta para dentro da linha do
agendamento. Depois, os DOIS portões dão prioridade a essa cópia:

- poller: `whatsapp-reminder-poller.service.ts:167` — `let shouldSend = appointment.remindClient;`
  e só cai no padrão da conta quando é NULL;
- entrega: `outbox-policy.ts:179` — `const permitido = doAgendamento ?? padraoDaConta;`

A "revalidação na entrega", que existe para consertar autorização que mudou no caminho, relê **a
mesma cópia congelada**. E o painel piora: `NewAppointmentModal.tsx:501` e `:1061` mandam
`remindClient: sendReminder` **sempre**, nunca omitido — então o campo nunca nasce NULL e o padrão
da conta fica permanentemente fora do jogo.

**Prova:** o dono desligou o padrão às 13:27:33 de hoje e saiu lembrete às 13:30:36 (linha
`cms8zcyzz000klg01vhtkq9fy`, `authorizedAt` NULL). Três minutos depois.

## 77.3 — O prazo de validade da fila nunca protege

A trava 1 impede a linha de nascer com o canal fechado. Consequência: quando o socket abre, **todas**
as linhas nascem naquele instante, com `createdAt = agora`. A trava 2 calcula
`idade = agora − createdAt` ≈ 0 e libera sempre. O prazo de 1 h para lembrete é decorativo
justamente no caso para o qual foi criado — a rajada de reconexão.

## 77.4 — Correção

1. **`queues.service.ts:136`** — se a janela do lembrete já passou, o lembrete não existe:
   `if (fireAt <= now) continue`, no lugar do `Math.max`.
2. **Poller** — só é candidato o agendamento cujo lembrete está REALMENTE vencendo agora: `start`
   dentro de ±30 min de `agora + 24h` ou de `agora + 2h`, em vez da faixa aberta de 24 h. Trinta
   minutos cobrem o tick de 60 s e uma parada curta, sem ressuscitar lembrete de ontem.
3. **Precedência, nos dois portões** — o padrão da conta passa a ser **veto**:
   `permitido = padraoDaConta && doAgendamento !== false`. O campo do agendamento só pode
   RESTRINGIR, nunca autorizar sozinho. É a leitura literal do que o dono pediu: *"não envia
   automático, só quando eu quiser"*.

Certificação em `outbox-policy.usecases.test.ts`: padrão desligado + agendamento marcado `true` não
envia; padrão ligado + agendamento `false` não envia; padrão ligado + agendamento NULL envia.
