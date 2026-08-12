# Estudo 69 — "Aguardando mensagem. Essa ação pode levar alguns instantes."

Relato do dono: a **Eduarda Anjos (La Belle de Jour)** mandou mensagem ontem (29/07) e o destinatário
viu *"Aguardando mensagem. Essa ação pode levar alguns instantes. Saiba mais"*.

## 69.1 — O que essa frase significa (pesquisa)

Não é erro de envio: a mensagem **saiu**. Ela aparece quando o aparelho de DESTINO não consegue
**decifrar** a mensagem (protocolo Signal): sessão vencida, aparelho novo, prekey trocada, sessão
fechada "in favor of incoming prekey bundle". Nesse caso o WhatsApp do destinatário devolve um
**retry receipt** pedindo o reenvio, e o remetente precisa responder mandando o conteúdo original
criptografado de novo.

No Baileys, quem responde a esse pedido é o callback **`getMessage(key)`**: a biblioteca chama para
recuperar o conteúdo daquela mensagem e re-encriptar. **Se `getMessage` devolver `undefined`, a
mensagem fica eternamente em "Aguardando"** — é exatamente o sintoma.

A documentação oficial confirma os três pontos: `getMessage` deve ser implementado com **store
persistente** ("needed for resending missing messages"), o `msgRetryCounterCache` deve viver **fora**
do socket para não reiniciar a contagem a cada reconexão, e `cachedGroupMetadata` importa para grupo.
As issues do repositório (#1701, #1739, #1643, #875, consolidadas em #1767) repetem o mesmo padrão:
"closing stale session / prekey bundle" no log e mensagem presa no destinatário.

Fontes: [docs de configuração do socket](https://baileys.wiki/docs/socket/configuration/),
[issue #1701](https://github.com/WhiskeySockets/Baileys/issues/1701),
[issue #1767 (consolidada)](https://github.com/WhiskeySockets/Baileys/issues/1767),
[issue #1739](https://github.com/WhiskeySockets/Baileys/issues/1739),
[issue #887 — "closing open session in favor of incoming prekey bundle"](https://github.com/WhiskeySockets/Baileys/issues/887).

## 69.2 — O que o NOSSO código faz hoje

`apps/api/src/modules/whatsapp/whatsapp.service.ts`:

- `makeWASocket` (`:1700`-`:1722`) já passa `getMessage`, `maxMsgRetryCount: 5` e
  `retryRequestDelayMs: 1000`. **Não passa `msgRetryCounterCache`** — a contagem de retry reinicia a
  cada reconexão (a doc pede o contrário, cache fora do socket).
- `getMessageForRetry` (`:1540`-`:1565`): procura no `sentCache` da sessão (memória, `SENT_CACHE_MAX
  = 300`, `:193`) e, se não achar, num registro de `WhatsappInboxMessage` com
  `direction: 'outbound'` e `whatsappMessageId`, remontando `{ conversation: text }`.
- `deliverOutbox` (`:1279`-`:1287`) guarda `sent.key.id → sent.message` **só no cache de memória** e
  atualiza `WhatsappInboxMessage` **quando a linha nasceu no inbox** (`inboxMessageId`).

### O buraco

Mensagem enviada pela FILA sem origem no inbox — confirmação, lembrete, cancelamento, convite,
campanha, `voltr_outbound` — **não tem cópia persistente do id nem do conteúdo**. Depois de
qualquer reinício da API (e ontem houve vários deploys: 18:43, 20:14, 20:51, 21:15) o `sentCache`
morre e `getMessage` devolve `undefined` para essas mensagens ⇒ "Aguardando" para sempre.

Conferi os dados de produção da La Belle: as mensagens da Eduarda saíram pelo inbox às 18:13–18:15 e
**têm** `whatsappMessageId` gravado — quatro delas ficaram em `sent` sem nunca virar `delivered`,
que é a assinatura do destinatário não conseguindo decifrar. Os convites de 23/07, esses, são do
caminho SEM cópia persistente.

Ou seja: para o caso dela o conteúdo existia, mas o socket precisa estar **no ar** quando o pedido de
reenvio chega — e ontem a API reiniciou várias vezes. Para o resto da fila, nem o conteúdo existia.

## 69.3 — Correção

1. `packages/db/prisma/schema.prisma` + migração aditiva: `WhatsappOutbox.whatsappMessageId String?`
   e `WhatsappOutbox.sentMessageJson Json?` — a cópia persistente do que foi enviado, inclusive de
   mídia (remontar `{conversation}` a partir do texto não serve para imagem/áudio).
2. `whatsapp.service.ts` `deliverOutbox`: grava os dois ao confirmar o envio.
3. `getMessageForRetry`: cache → **outbox** → inbox, tudo escopado por empresa.
4. `msgRetryCounterCache` compartilhado, criado FORA do socket e reaproveitado nas reconexões.
   Vive em `apps/api/src/modules/whatsapp/retry-cache.ts:1` — arquivo próprio porque tem lógica de
   verdade (TTL, teto, despejo do mais antigo) e precisa de teste; implementação mínima com a
   interface `CacheStore` que o Baileys espera (`get`/`set`/`del`/`flushAll`), sem dependência nova.
5. `SENT_CACHE_MAX` 300 → 1000 (mensagem antiga demais sai do cache antes do retry chegar).

## 69.4 — Certificação

`apps/api/src/modules/usecase-tests/retry-cache.usecases.test.ts`, registrado em
`apps/api/src/modules/usecase-tests/run-usecases.ts`: prova que o contador sobrevive à reconexão
(é o mesmo objeto), que respeita TTL, que despeja o mais antigo ao estourar o teto e que
`flushAll`/`del` fazem o que o Baileys espera.

O que isso NÃO resolve, e é honesto dizer: se o aparelho do destinatário pedir o reenvio enquanto a
nossa API está reiniciando, ninguém responde naquele instante. O que passa a existir é a cópia
persistente para responder na próxima tentativa — antes, nem isso havia.
