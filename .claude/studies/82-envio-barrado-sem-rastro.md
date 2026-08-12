# Estudo 82 — Envio barrado pela trava 1 some sem deixar rastro

Sequência do dono: cancelou dois agendamentos e nenhuma mensagem chegou. Ele perguntou por quê e não
tinha como saber — não havia nada na tela.

## 82.1 — O que aconteceu, provado no log

Meu deploy da API terminou às 17:02:06 (App Runner, `UPDATE_SERVICE` SUCCEEDED). O App Runner troca o
container, e a sessão do Baileys vive dentro do processo: caiu junto. Log da aplicação:

```
17:09:06 WARN Outbox: cancellation para +19182384714 NÃO enfileirada (company=DesignModa)
              — WhatsApp desconectado: mensagem automática não é enfileirada (evita rajada).
17:10:00 WARN (idem, segundo cancelamento)
17:10:10  LOG WhatsApp conectado (company=DesignModa).
```

A sessão voltou **10 segundos depois** do segundo cancelamento. A trava fez exatamente o que devia:
`whatsapp.service.ts:856`-`:866`, via `podeEnfileirar` (`outbox-policy.ts:71`-`:84`), recusa
enfileirar automação com o canal fechado — é o que impede a rajada no reconnect.

Os dois agendamentos tinham `notifyCancellation = true`, e o sino do painel registrou os dois
(`Notification` tipo `appointment.canceled`, 17:09:06 e 17:10:00). Ou seja: autorização certa,
código certo, canal fechado.

## 82.2 — O defeito real: a recusa é invisível

`whatsapp.service.ts:861`-`:866` faz `return null` com um `logger.warn`. Não nasce linha em
`WhatsappOutbox`, não há status, não há histórico. Da cadeira do dono é indistinguível de "o sistema
não fez nada" — foi por isso que ele veio perguntar em vez de ver na tela.

Isso contraria a regra permanente do projeto (CLAUDE.md):

> Todo disparo precisa de idempotência, histórico e status honesto: `na fila`, `enviado`,
> `entregue`, `lido` ou `falhou`.

"Sumiu" não é um dos cinco.

## 82.3 — Dois agravantes que estavam junto

1. **O log do agendamento só mostra confirmação.** `appointments.service.ts:443`-`:444` filtra
   `kind: 'confirmation'`. Mesmo que a linha de cancelamento existisse, a aba "Logs" do
   `AppointmentConfirmationDrawer` (`:517`) nunca a mostraria. Lembrete idem.
2. **Não há como reenviar.** Existe o envio manual de confirmação
   (`appointments.controller.ts:129`, `sendConfirmation`), mas nada equivalente para uma mensagem
   que falhou — nem genérico, por linha.

## 82.4 — Correção

1. **Rastro honesto.** Quando `podeEnfileirar` recusa, gravar a linha já em estado terminal
   (`status: 'failed'`, `lastError` = o motivo), em vez de sumir. Ela **nunca** entra na fila de
   envio: o remetente busca `status: 'pending'` e `nextAttemptAt <= agora` (`:1182`-`:1183`), então
   `failed` é invisível para ele. O comportamento anti-rajada fica intacto — muda só o rastro.
   `enqueueText` continua devolvendo `null`, porque nada foi enfileirado de fato; quem chama
   (`notifications.service.ts:389`) já ignora o retorno.
   Dedupe: não criar uma segunda linha falhada idêntica (mesma empresa, agendamento, kind e texto)
   dentro da janela já usada para duplicatas — senão uma automação repetida vira lista de lixo.
2. **Mostrar os três tipos.** O log do agendamento passa a incluir `cancellation` e `reminder`, e a
   devolver `kind` para a tela rotular.
3. **Reenviar por linha.** Endpoint que pega uma linha falhada e reenfileira o MESMO texto com
   `authorized: true` — é uma pessoa clicando, que é justamente o que isenta da trava 1 (`:77`) e da
   revalidação de automação. Idempotente por `requestKey`, como o envio manual de confirmação.
4. **Botão na aba Logs**, só nas linhas que falharam.

## 82.5 — O que NÃO muda

A trava 1 continua recusando automação com o canal fechado — ela está certa e é o que protege contra
a rajada. O reenvio é **manual**, nunca automático: automático no reconnect é exatamente o incidente
que a trava existe para impedir. E a linha reenviada passa pelo portão de entrega normalmente,
exceto pela isenção que o clique de uma pessoa já concede hoje no envio manual de confirmação.
