/**/
# Estudo 158 — uazapi como provedor de WhatsApp da La Belle

Pedido do dono:

> "integre uazapi.dev no salonpass para agendamento, confirmação, acompanhamento
> somente por agora para o La Belle de Jour. depois vamos botar em outros salões"

E, quando perguntei se substituía o Baileys: **"Substituir na La Belle"**.

## Arquivos tocados

- `apps/api/src/modules/whatsapp/uazapi.client.ts` (novo)
- `apps/api/src/modules/whatsapp/uazapi-webhook.controller.ts` (novo)
- `apps/api/src/modules/whatsapp/uazapi-webhook.service.ts` (novo)
- `apps/api/src/modules/whatsapp/whatsapp.service.ts`
- `apps/api/src/modules/whatsapp/whatsapp.module.ts`

## Por que trocar o transporte só nesta empresa

O Baileys é biblioteca não-oficial: a sessão da La Belle caiu com `loggedOut` em
12/08 às 12:47 e exigiu repareamento humano (estudo 157). A uazapi é um serviço
que mantém a sessão do lado dele — o SalonPass passa a falar HTTP com um
provedor em vez de manter um WebSocket vivo.

O número dela **já está pareado na uazapi** (verificado: `status: connected`,
`profileName "Eduarda Anjos"`, `systemName: "free"`). Com o mesmo número em dois
lugares, o WhatsApp derruba um; por isso o Baileys precisa parar de tentar
conectar essa empresa quando ela estiver na uazapi.

## O contrato da uazapi (verificado no servidor, não na documentação)

A documentação é uma SPA que não expõe o spec por fetch. Levantei o contrato
contra o servidor real, sem enviar nenhuma mensagem — só respostas de erro:

| o quê | como |
|---|---|
| base | `https://free.uazapi.com` |
| autenticação | header `token` com o token DA INSTÂNCIA |
| enviar texto | `POST /send/text`, corpo `{ number, text }` (corpo vazio → 400 "Missing required fields"; só um dos dois → 400 também) |
| estado | `GET /instance/status` → `{ instance: { status, owner, profileName, qrcode, paircode, … } }` |
| webhook | `GET/POST /webhook`; hoje devolve `null` (nada configurado) |
| não existem | `/message/sendText` e `/sendText` → 405 |
| rota de admin | `/instance/all` → 401 com token de instância |

O plano do Codex (`.claude/planos/uazapi-integracao.md`) confirmou pelo OpenAPI
oficial 2.1.1 os eventos de webhook: `messages` (recebidas) e **`messages_update`**
(é onde vêm `Delivered` e `Read`).

## Onde o transporte entra

`whatsapp.service.ts:1425-1450` é o único ponto que fala com o WhatsApp de
verdade: quatro `session.sock.sendMessage(...)` conforme o tipo de mídia. Todo o
resto — autorização (`:1370-1389`), idempotência por `requestKey`, pacing
(`:1391`), gravação de `sent`/`failed` (`:1470-1523`) — é do outbox e vale para
qualquer transporte.

Então a troca acontece **ali dentro**, e nada mais muda: quem chama
`enqueueText` não sabe (nem precisa saber) qual provedor levou a mensagem.

## A escolha por empresa

`Setting` com chave `whatsapp.provider` e `valueJson = { "provider": "uazapi" }`.
Ausência da linha, JSON inválido ou qualquer outro valor → Baileys. É o mesmo
mecanismo de `notifications.automation` (`notification-settings.service.ts:26`),
sem inventar tabela nova.

**Sem fallback silencioso**: se a uazapi falhar num envio, a mensagem volta para
a fila com o erro registrado e tenta de novo pela uazapi. Cair para o Baileys no
meio de um envio poderia duplicar uma mensagem cujo resultado da primeira
tentativa é incerto — e mensagem duplicada para cliente real é dano.

## O que fica honesto sobre entrega

Hoje `delivered`/`read` nunca chegam ao `WhatsappOutbox` — o ACK do Baileys só
alimenta `WhatsappInboxMessage`. Quem lê `outbox.status` cru
(`reports.service.ts`, `customers.service.ts`) nunca mostra "Entregue"/"Lida".

O webhook da uazapi corrige isso no caminho novo. Mas o envelope do callback
**não está documentado** — o OpenAPI lista os eventos, não o JSON. Por isso o
parser é defensivo: reconhece o que consegue mapear e, diante de formato
desconhecido, registra e NÃO promove status. Marcar "entregue" por suposição é
pior que não marcar — a regra do projeto é status honesto.
