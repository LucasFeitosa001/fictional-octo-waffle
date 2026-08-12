# Estudo 73 — Automação saía sem conseguir verificar o agendamento

Relato do dono, em letras maiúsculas e com razão: *"quando eu conectei ao WhatsApp ele enviou
mensagem automática pro Daniel… PELO AMOR DE DEUS NÃO FAÇA ENVIAR MENSAGEM AUTOMÁTICA, SOMENTE SE A
PESSOA AUTORIZAR… TODA VEZ QUE CONECTAR AO WHATSAPP ELE ENVIA AUTOMÁTICO, MESMO QUE O AGENDAMENTO JÁ
TENHA PASSADO."*

## 73.1 — O que de fato saiu

Uma linha, `kind='reminder'`, `companyId=cmryy21zj000hjx01lmccyco0` (DesignModa):
`createdAt 2026-07-31 13:15:35.628`, `sentAt 13:15:37.832` — **2,2 segundos na fila**. Não foi
mensagem velha drenada no reconnect: a rotina de lembrete criou e o outbox despachou em seguida,
11 minutos depois de o WhatsApp reconectar. Ela tinha `appointmentId` e o horário era futuro
("amanhã, às 10h15"), então passou por todas as travas — autorizada pelo padrão da conta, que
estava `reminder: true` desde 24/07.

Já os três lembretes de 29/07 ficaram **4h30, 5h49 e 6h18** parados e saíram todos às 19h49–19h52,
quando a conexão voltou. E esses **não tinham `appointmentId`**.

## 73.2 — O buraco

`apps/api/src/modules/whatsapp/outbox-policy.ts:147`-`:181`, em `autorizacaoAindaVale`:

```
if (kind === 'confirmation' || kind === 'cancellation' || kind === 'reminder') {
  if (agendamento === null) return { ok: false, motivo: 'Agendamento não existe mais' };
  if (agendamento) { …canceled? já passou? toggle? … return { ok: true } }
  // agendamento === undefined cai FORA dos dois
}
… return padrao ? { ok: true } : { ok: false, … }
```

`agendamento` vem de `agendamentoDaLinha` (`whatsapp.service.ts:1403`), que só é chamado quando a
linha tem `appointmentId`. Sem ele o valor é **`undefined`** — e aí **nenhuma** das travas roda:
nem "o horário já passou" (`:157`), nem "foi cancelado depois" (`:152`), nem o toggle do
agendamento. A execução escorrega até `:183` e devolve `ok: true` sempre que o padrão da conta
estiver ligado.

Ou seja: a trava do horário passado existe e funciona — **mas só para quem tem agendamento
verificável**. Para o resto, o aviso automático saía sem verificação nenhuma. É esse o caso que o
dono viu.

## 73.3 — Correção

Fechar por padrão. Em `outbox-policy.ts`, para `confirmation | cancellation | reminder`, quando o
agendamento **não pode ser verificado** (`undefined`), recusar o envio em vez de escorregar para o
padrão da conta. Mensagem automática que não dá para conferir não sai — é a leitura literal da regra
do `CLAUDE.md`: *"O padrão sistêmico de toda automação é desligado."*

Certificação em `apps/api/src/modules/usecase-tests/outbox-policy.usecases.test.ts`: um caso novo
provando que `agendamento: undefined` é recusado para os três tipos, mesmo com o padrão da conta
ligado, e que `followup`/`campaign` (que legitimamente não têm agendamento) seguem inalterados.

## 73.4 — Ação imediata já tomada

- Conferida a fila de TODAS as empresas: **zero** linhas em `pending`/`queued`/`retry`. Nada armado.
- `notifications.automation` do DesignModa **desligado** (era
  `{reminder:true, cancellation:true, confirmation:true, notifyProfessional:true}`, ligado pelo
  próprio dono em 24/07). Agora as duas empresas com registro estão com tudo `false`.
