# Estudo 91 — “Na fila” não é “enviada”

Pedido permanente do projeto: todo disparo deve ter estado honesto — `na fila`,
`enviado`, `entregue`, `lido` ou `falhou`; somente os ACKs do WhatsApp promovem
a mensagem.

## Evidência no caminho real

- `apps/api/src/modules/voltr/voltr.controller.ts:124` recebe a resposta da
  Voltr, cria uma linha `WhatsappOutbox` e devolve `acked: false`. Nesse ponto a
  SalonPass apenas aceitou o item na fila.
- `apps/api/src/modules/whatsapp/whatsapp.service.ts:1390` muda a outbox para
  `sent` somente depois de `sock.sendMessage` retornar e guarda o id definitivo
  do WhatsApp.
- `apps/api/src/modules/voltr/voltr-forwarder.service.ts:31` já traduz os ACKs
  `sent`, `delivered` e `read` para `enviada`, `entregue` e `lida` na Voltr.
- No lado Voltr, `apps/api/src/mensageria/mensageria.service.ts:164` tratava o
  simples HTTP 200/`enfileirado:true` do conector como `enviada`. Além disso, os
  chamadores criavam a `Mensagem` com `statusEntrega='enviada'` antes de chamar
  a rede.

O incidente do simulador confirmou a diferença: a linha
`requestKey=421de263-de51-4f55-a0a2-5a54af5af60b` ficou `sent`, mas sem ACK
`delivered` nem `read`. “Aceita pela fila”, “aceita pelo servidor do WhatsApp” e
“entregue ao aparelho” são fatos diferentes.

## Decisão

1. Toda saída nova nasce `na_fila`; `enviando` continua reservado ao balão
   otimista do frontend antes da resposta da API.
2. HTTP 200 do conector externo com `acked:false` conserva `na_fila`.
3. `acked:true` do conector interno ou sucesso da Graph API promove para
   `enviada`.
4. O forwarder da SalonPass deixa de assumir que `sent` já foi pago. Depois de
   copiar a mensagem de saída para a Voltr, ele registra o ACK `sent`; ACKs
   posteriores continuam promovendo monotonicamente para `entregue` e `lida`.
5. `simulada` e `falha` continuam terminais e não entram nessa progressão.

Nenhum envio real é necessário para testar a máquina: os testes usam stubs do
conector e certificam cada transição.
