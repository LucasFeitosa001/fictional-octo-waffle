# Estudo 98 — a IA repetia o catálogo e cada fala dela vinha duplicada

Dois defeitos distintos apareceram no mesmo print de conversa.

## 1. Toda fala da Mariana aparecia de novo como "Você:"

Arquivos:
- `apps/api/src/modules/whatsapp/whatsapp.service.ts`
- `apps/api/src/modules/voltr/voltr-forwarder.service.ts`

A Voltr grava a mensagem no painel dela e pede o envio ao SalonPass com
`kind: 'voltr_outbound'`. O Baileys devolve essa mesma mensagem no
`messages.upsert` com `fromMe: true`. O encaminhador — que passou a mandar os
dois sentidos no estudo 78 — não distinguia origem e devolvia a mensagem para a
Voltr, que criava uma SEGUNDA linha (`doSalao: true`) com texto idêntico.

Correção: o envio marca `sent.key.id` num Set em memória no mesmo tique em que o
id existe; o encaminhador consulta `nasceuNaVoltr(messageId)` e pula só o
`encaminharInbound`. O `registrarAck` continua indo, senão a mensagem original
ficaria presa em "na fila". O Set morre no restart — o pior caso é uma duplicata
isolada, nunca uma mensagem perdida.

## 2. O catálogo de serviços se repetia em toda mensagem

Arquivo: `apps/api/src/autopilot/agenda-tools.service.ts` (repo belivin-ia)

O atalho que existe para o LLM não inventar serviço dispara quando NENHUM nome do
cadastro casa com a fala. Depois do impasse de agenda ("não encontrei
disponibilidade"), falas como "já vi uns erros" ou "tenho que falar com a mina"
também não casam — e recebiam a mesma lista, para sempre.

Correção: se o catálogo já foi a última coisa que a IA disse, não repete; devolve
o turno ao modelo. A trava contra serviço inventado continua valendo na primeira
vez, que é quando ela importa.
