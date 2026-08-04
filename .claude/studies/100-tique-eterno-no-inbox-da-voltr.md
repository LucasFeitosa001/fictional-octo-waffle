# Estudo 100 — o tique eterno no inbox da Voltr

Sintoma que o dono vê: no inbox do CRM, **toda** mensagem que sai fica com o
relógio para sempre, como se nunca tivesse sido enviada. Ele quer o padrão do
WhatsApp: ✓ enviada, ✓✓ entregue, ✓✓ azul lida.

## Arquivos tocados

- `apps/api/src/modules/whatsapp/whatsapp.service.ts`
- `apps/api/src/modules/voltr/voltr-forwarder.service.ts`
- `apps/api/src/modules/usecase-tests/voltr-forwarder.usecases.test.ts`

## A UI não tem culpa

`belivin-ia/apps/web/app/components/crm/InboxChatMessage.tsx:22` (`Ticks`) já
desenha exatamente o que o dono pede: `falha`→X, `enviando|na_fila`→relógio,
`enviada`→1 tique, `entregue`→2, `lida`→2 azuis (#53bdeb). Ela lê
`statusEntrega`. O defeito é o dado que chega nesse campo.

## Duas chaves que nunca casam

1. Quem manda enviar é a Voltr. `belivin-ia/apps/api/src/mensageria/mensageria.service.ts:194`
   (`garantirExternalId`) gera um `randomUUID()`, **grava em `Mensagem.externalId`**
   e manda esse UUID no corpo para o conector.
2. `apps/api/src/modules/voltr/voltr.controller.ts:268` recebe esse UUID
   (`dto.externalId?.trim() || randomUUID()`) e o guarda como `requestKey` na
   linha do `WhatsappOutbox` com `kind: 'voltr_outbound'` (`:275`).
3. Depois do envio real, a MESMA linha recebe `whatsappMessageId`
   (`apps/api/src/modules/whatsapp/whatsapp.service.ts`, bloco que grava
   `status:'sent'`/`sentAt`/`whatsappMessageId`). **O vínculo UUID ↔ id do
   WhatsApp existe, numa linha só — e nunca era usado.**
4. O ACK vinha do Baileys com o id do WhatsApp e
   `apps/api/src/modules/voltr/voltr-forwarder.service.ts` despachava
   `externalId: ack.whatsappMessageId` para o `/api/ingest/status`.
5. Do outro lado, `belivin-ia/apps/api/src/ingest/ingest.service.ts:239`
   (`atualizarStatus`) faz `mensagem.findFirst({ where: { externalId } })`. O id
   do WhatsApp não é o `externalId` daquela Mensagem → `mensagem_nao_encontrada`
   → 3 retentativas → desiste em silêncio. `statusEntrega` fica `na_fila` para
   sempre.

`mensageria.service.ts:155-157` deixa a regra explícita do lado da Voltr: *"O
NOSSO externalId (estável) é a chave de correlação; o id que o conector devolve
(`r.externalId`) é só informativo; não sobrescrevemos."*

Contagem do dono em `emp_designmoda."Mensagem"` (saídas, 10 dias, 04/08):
`lida` 182 e `entregue` 23 e `enviada` 22 — todas com externalId no formato do
WhatsApp (`4A04FDCD589D3EF0717E`), a mais recente de 31/07; `na_fila` 33 — todas
com UUID (`edbfc94b-56b6-435f-b456-…`), a mais recente de hoje.

## Por que "antes funcionava"

Antes do estudo 98, a mensagem que a Voltr mandava enviar voltava pelo eco
`fromMe` do Baileys e o forwarder a subia de novo por `/api/ingest/mensagem`
com `externalId = id do WhatsApp`. Isso criava uma Mensagem **duplicada** — e
era essa duplicata que recebia os tiques. O estudo 98 fechou a porta do eco
(certo: a duplicata era o defeito), e com ela foi embora a única linha na Voltr
cujo `externalId` casava com o ACK. Os tiques precisam voltar **sem** a
duplicata.

As 182 `lida` continuam sendo o caminho legítimo do salão: quando o atendente
digita no celular, quem cria a Mensagem na Voltr é o nosso
`/api/ingest/mensagem` com `externalId: msg.messageId` — o id do WhatsApp. Para
essas, o ACK com o id do WhatsApp está certo e não pode mudar.

## Decisão

**Traduzir o id no despacho do ACK, com o que já está em memória.**

`whatsapp.service.ts` já mantinha `nascidasNaVoltr` (estudo 98) para saber o que
não devolver à Voltr. Ele vira `Map<id do WhatsApp, externalId da Voltr>`,
alimentado no mesmo tique do envio com o `requestKey` da linha do outbox
(`marcarNascidaNaVoltr`), e expõe `externalIdDaVoltr(messageId)`.

O forwarder consulta esse mapa **uma vez, no momento em que já anota a mensagem
encaminhada** (`lembrarEncaminhada`) — a mesma linha do fluxo em que já consulta
`nasceuNaVoltr`. `registrarAck` despacha
`encaminhada.externalIdNaVoltr ?? ack.whatsappMessageId`.

Memória em vez de consulta ao banco, e o motivo não é economia: `registrarAck`
já sai calado quando a mensagem não está em `encaminhadas`, que também é memória
e nasce vazia no restart. Um par que o banco teria e a memória não teria
pertence a uma mensagem cujo ACK o forwarder já descarta. Ir ao banco custaria
uma consulta por ACK de **todo** salão (inclusive quem não usa Voltr) e tornaria
assíncrono um handler que hoje é síncrono de propósito — sem ganhar um único
tique.

### O que foi descartado

Devolver o `whatsappMessageId` na resposta do `POST /voltr/whatsapp/send`
(`{ ok, externalId, acked }`) não resolve:

- a resposta sai no **enfileiramento**, antes do envio real; nesse instante
  `whatsappMessageId` ainda é `null` (conferido na linha `voltr_outbound` do
  banco local: `status=pending`, `whatsappMessageId` vazio);
- mesmo que existisse, a Voltr ignora `r.externalId` de propósito
  (`mensageria.service.ts:155-157`), porque o UUID dela é a chave de
  idempotência que dedupa o reenvio no nosso outbox. Trocá-la exigiria mexer nos
  dois lados e enfraqueceria o dedupe.

A tradução no ACK é mudança de um repositório só (SalonPass) e não toca em
nenhum contrato.

## Invariantes preservadas

- Mensagem digitada pelo salão continua indo com o id do WhatsApp.
- O eco do estudo 98 continua fechado: nada nascido na Voltr volta como cópia.
- A escada da Voltr continua monotônica — a tradução muda a chave, não o degrau.
- Sem `requestKey` o par vira identidade: comportamento idêntico ao de antes.

## O que os testes cobrem

`apps/api/src/modules/usecase-tests/voltr-forwarder.usecases.test.ts` dirige o
forwarder pelo `onModuleInit` com dublês do WhatsappService e do VoltrService e
verifica o `externalId` que chega no `enviarStatus`, nos dois caminhos, mais o
par em memória (guarda, ausência, identidade e teto FIFO pela chave).

Nenhum envio real é necessário — e nenhum foi feito.
