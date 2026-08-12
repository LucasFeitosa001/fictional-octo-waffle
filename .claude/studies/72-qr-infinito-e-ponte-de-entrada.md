# Estudo 72 — QR que carrega para sempre, e o WhatsApp que "não conecta" na Voltr

Dois relatos do dono, na mesma rodada: *"por que o local do QRcode fica carregando para sempre?"* e
*"conectei o WhatsApp à página e mesmo assim continua 'Nenhum WhatsApp conectado'"*.

## 72.1 — O QR da SalonPass está bom; o problema é o da Voltr

Testei as três telas nossas no navegador em produção (`/ia-atendimento`, `/whatsapp`,
`/configuracoes`): a imagem de 320×320 renderiza, `GET /whatsapp/connection/status` e
`/whatsapp/connection/qr.png` devolvem 200, sem um erro de console. O QR travado é o da Voltr.

## 72.2 — Por que o da Voltr gira para sempre

`apps/web/app/components/WhatsAppQRScanner.tsx:47`-`:53` define o estado assim:

```
const estado = !status ? 'carregando' : !status.alcancavel ? 'offline' : …
```

`status` só é preenchido quando a chamada dá certo (`setStatus(s)` no `try`). Se ela **falhar**, o
`catch` grava a mensagem em `erro` e o `status` **continua nulo para sempre** — então `estado` fica
em `'carregando'` e a linha `:69` (`{estado === 'carregando' && <Spinner color="accent" />}`) gira
sem fim. O erro existe na tela, mas só como texto vermelho pequeno em `:111`-`:112`, fácil de não
ver. E o caso `'aguardando'` (`:89`-`:94`) também é um spinner, com o texto "Gerando o QR code…" —
igualmente sem saída.

Há **duas** causas independentes, ambas decisões de segurança propositais:

1. **Módulo `whatsapp` não habilitado no tenant.** Provei chamando o endpoint com um token de embed
   real: `{"message":"Contrate o módulo WhatsApp","error":"Forbidden","statusCode":403}`. Ao criar o
   tenant `designmoda` habilitei só `crm` e `atendimento`.
2. **O papel do usuário do embed é sempre `atendente`** — `apps/api/src/embed/embed.service.ts:236`
   ("role MÍNIMA — nunca admin") — e `apps/api/src/integrations/integrations.controller.ts:30`-`:31`
   só entrega o QR a `admin_empresa`/`super_admin`, devolvendo `qr: ''` aos demais porque *"o QR
   pareia o WhatsApp da empresa inteira em qualquer celular"*. Isso cai em `'aguardando'` — spinner
   de novo.

Ou seja: uma trava de módulo e uma de permissão aparecem, as duas, como carregamento infinito.

## 72.3 — Por que "Nenhum WhatsApp conectado" mesmo depois de conectar

O dono pareou o WhatsApp **no nosso painel**, e funcionou: `GET /whatsapp/connection/status` devolve
`{"status":"open","hasQr":false,"phone":"558981312500"}`, com 99 chaves em `WhatsappAuthState`.

Só que **são dois conectores independentes**. O inbox da Voltr é alimentado ou pelo conector dela
(`belivin-whatsapp`, pareado no número do Alecrim) ou pela **nossa ponte de entrada**:
`VoltrForwarderService` escuta cada mensagem recebida e chama
`apps/api/src/modules/voltr/voltr.service.ts:146` — `POST {apiUrl}/api/ingest/mensagem` com
`x-ingest-token` e `x-tenant-schema`.

Do lado da Voltr, `apps/api/src/ingest/ingest.controller.ts:166` recebe, e `:138`-`:143` exige que o
tenant tenha **`ingestToken` próprio** ("segredo por-tenant obrigatório").

Em produção eu configurei só as 6 variáveis do embed — **sem `VOLTR_INGEST_TOKENS`**. Com isso
`resolveIngestToken` devolve vazio e o encaminhamento sai pelo `return` da linha `:144` sem fazer
nada. A ponte está inerte: por isso nada chega.

## 72.4 — Correção

1. **Ponte de ENTRADA ligada** para o `designmoda`: gerar um segredo, gravar em
   `platform."Empresa".ingestToken` e publicar em `VOLTR_INGEST_TOKENS` no App Runner. É via de mão
   única — mensagem **recebida** é copiada para o inbox da Voltr. **Nada é enviado**, então não toca
   nas travas do estudo 60 nem na regra do CLAUDE.md.
2. **Nada de ligar a via de SAÍDA** (`connectorWebhookUrl`/`connectorSecret` no tenant). É ela que
   deixaria a Voltr disparar pela nossa fila, e `voltr_outbound` é isento das travas por desenho.
   Fica para autorização explícita do dono, com número de destino definido.
3. **`WhatsAppQRScanner.tsx`**: falha de chamada deixa de virar spinner eterno. Passa a existir um
   estado de erro que mostra o motivo, e o `'aguardando'` explica que o pareamento é feito por quem
   é dono da conta — em vez de prometer um QR que nunca vem.
4. **Não** habilitar o módulo `whatsapp` nem promover o papel do embed. Para tenant que vem da
   SalonPass o pareamento é no nosso painel e a Voltr recebe pela ponte; dar admin ao usuário do
   embed deixaria qualquer um vincular o WhatsApp do salão em outro celular.
