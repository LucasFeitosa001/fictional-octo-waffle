# Plano de integração da uazapi como provedor alternativo de WhatsApp

Data da pesquisa: 12/08/2026

Escopo do piloto: somente **La Belle de Jour**, `companyId = cmrxytgwg000hk001x485cp24`

Estado deste documento: pesquisa e plano; **nenhuma conexão, webhook, fila ou mensagem real foi acionada**.

## 1. Decisão proposta

Manter `WhatsappService` como a fachada usada pelo restante do SalonPass e colocar a escolha do transporte atrás dela. A fachada continua sendo dona da autorização, idempotência, outbox, histórico, retentativas e eventos normalizados; Baileys e uazapi cuidam apenas da conexão e das operações do provedor.

O provedor será escolhido no backend por uma `Setting` da empresa:

```json
{
  "companyId": "cmrxytgwg000hk001x485cp24",
  "key": "whatsapp.provider",
  "valueJson": { "provider": "uazapi" }
}
```

Ausência da `Setting`, JSON inválido ou qualquer valor diferente de `uazapi` resulta em `baileys`. A `FeatureFlag` já existente `whatsapp_api` continua sendo o direito de usar o módulo, não a escolha do fornecedor. Não haverá fallback silencioso de uazapi para Baileys durante um envio: isso poderia duplicar uma mensagem cujo resultado da primeira tentativa fosse incerto.

## 2. Fontes consultadas e critério de autoridade

1. [OpenAPI oficial, versão 2.1.1](https://docs.uazapi.com/openapi-bundled.json): fonte principal para host, autenticação, paths, corpos, respostas e eventos.
2. [Documentação oficial renderizada](https://docs.uazapi.com/): confirma a versão e expõe o download da especificação.
3. [Coleção pública Postman uazapi v2](https://www.postman.com/augustofcs/uazapi-v2/documentation/dhsg7sc/uazapigo-whatsapp-api-v2-0) e requisições específicas de [conexão](https://www.postman.com/augustofcs/uazapi-v2/request/5cxkhbf/conectar-gera-qrcode-ou-pair-code), [texto](https://www.postman.com/augustofcs/uazapi-v2/request/69nsv0l/enviar-texto) e [webhook](https://www.postman.com/augustofcs/uazapi-v2/request/so8w6vz/definir-webhook).
4. [Coleção pública antiga “uazapi - WhatsApp API v1.0”](https://www.postman.com/augustofcs/uazapi/collection/j48ko4t/uazapi-whatsapp-api-v1-0): consultada para identificar deriva de versão, não para definir o contrato novo.
5. [`n8n-nodes-uazapi` 1.0.4 no UNPKG](https://app.unpkg.com/n8n-nodes-uazapi%401.0.4/files/README.md), que declara 90+ endpoints e documenta URL do servidor, Admin Token e Instance Token. É artefato comunitário auxiliar, não substitui o OpenAPI oficial.
6. [MCP `@pabloweyne/uazapi-mcp`](https://glama.ai/mcp/servers/pabloweyne/uazapi-mcp) e seu [schema](https://glama.ai/mcp/servers/%40pabloweyne/uazapi-mcp/schema): usa `UAZAPI_API_KEY` e `UAZAPI_INSTANCE_ID`, nomenclatura incompatível com o contrato oficial 2.1.1. Portanto, não foi usado para definir autenticação do SalonPass.
7. [Repositório histórico oficial `uazapi/uazapi`](https://github.com/uazapi/uazapi): declara que a v1 baseada em Baileys foi descontinuada e que a v2 é outro produto.

Há uma divergência concreta: a coleção Postman v2 ainda mostra `POST /instance/init` para criação, enquanto o OpenAPI oficial atual 2.1.1 define `POST /instance/create`. O plano adota `/instance/create`. `/instance/init` fica classificado como **legado / não usar sem confirmação do fornecedor**.

Também não se deve vender o piloto como migração para a API oficial da Meta. O fluxo de QR/pairing code continua sendo o de dispositivo vinculado. O repositório histórico afirma apenas que a **v1** era baseada em Baileys e foi substituída; **HIPÓTESE NÃO CONFIRMADA:** a implementação interna da v2 não é pública nas fontes consultadas, portanto não foi possível confirmar qual biblioteca/protocolo ela usa. O ganho a testar é operacional (sessão hospedada e API HTTP), não uma mudança comprovada para WhatsApp Cloud API/BSP.

## 3. Contrato da uazapi confirmado

### 3.1 URL base e identidade da instância

- O OpenAPI declara `https://{subdomain}.uazapi.com`, com `free` e `api` como valores conhecidos e `free` como padrão. Fonte: [OpenAPI oficial](https://docs.uazapi.com/openapi-bundled.json).
- O pacote n8n descreve a URL como `https://seudominio.uazapi.com`, ou seja, o dono deve fornecer o host exato exibido na conta/servidor. Fonte: [README do `n8n-nodes-uazapi`](https://app.unpkg.com/n8n-nodes-uazapi%401.0.4/files/README.md).
- Não há evidência no contrato de que cada instância receba um host diferente. A evidência aponta para um host por servidor/conta e um `token` diferente por instância. Logo, `UAZAPI_BASE_URL` deve guardar o host recebido do fornecedor e `UAZAPI_INSTANCE_TOKEN` identifica a instância da La Belle de Jour.
- O host não deve ser montado a partir do `companyId` nem aceito do frontend.

### 3.2 Autenticação

Os nomes exatos, em minúsculas na documentação, são:

| Escopo | Header exato | Valor | Como é obtido |
|---|---|---|---|
| Operações da instância, conexão, mensagem e webhook | `token` | token da instância | Retornado na criação da instância; também disponibilizado na administração da conta |
| Administração/criação de instância | `admintoken` | token administrativo | Obtido após login, na conta/servidor uazapi |

O OpenAPI define ambos como `apiKey` em header e informa que a criação devolve um token único da instância. Fonte: [OpenAPI oficial](https://docs.uazapi.com/openapi-bundled.json). O fluxo de obtenção no painel é corroborado pelo [README do pacote n8n](https://app.unpkg.com/n8n-nodes-uazapi%401.0.4/files/README.md).

Não usar `apikey`, `x-api-key`, Bearer, `UAZAPI_API_KEY` ou `UAZAPI_INSTANCE_ID` no cliente HTTP da integração atual: esses nomes não pertencem ao contrato oficial 2.1.1 consultado.

### 3.3 Criar, conectar e obter QR/pairing code

#### Criar instância

```http
POST /instance/create
admintoken: <admin token>
Content-Type: application/json
```

Corpo mínimo exato:

```json
{
  "name": "la-belle-de-jour"
}
```

`adminField01` e `adminField02` são opcionais. A resposta inclui `instance.token`; ele deve ser guardado como segredo. Fonte: [OpenAPI oficial](https://docs.uazapi.com/openapi-bundled.json).

Para o piloto, é preferível o dono criar a instância no painel e fornecer apenas o token da instância. Assim, o runtime do SalonPass não precisa carregar `admintoken`. Se o servidor `free` for apenas demo, endpoints administrativos podem estar desabilitados; o próprio OpenAPI mostra esse comportamento para operações administrativas de demo. Fonte: [OpenAPI oficial](https://docs.uazapi.com/openapi-bundled.json).

#### Conectar

```http
POST /instance/connect
token: <instance token>
Content-Type: application/json
```

- Omitir o corpo ou enviar `{}` inicia o QR code.
- Enviar `{"phone":"5511999999999"}` gera pairing code.
- `phone` usa o formato internacional documentado `5511999999999`: DDI `55`, somente dígitos no exemplo e sem sufixo. A documentação consultada não diz se uma entrada com `+` também seria aceita; o adapter deve enviar sempre a forma canônica sem `+`.
- Acompanhar com `GET /instance/status`, também autenticado por `token`. A resposta da instância pode conter `qrcode` em base64/data URL e `paircode`.

Fontes: [OpenAPI oficial](https://docs.uazapi.com/openapi-bundled.json) e [requisição Postman de conexão](https://www.postman.com/augustofcs/uazapi-v2/request/5cxkhbf/conectar-gera-qrcode-ou-pair-code).

`WhatsappService.getQrDataUrl()` deve normalizar o valor: preservar um `data:image/...;base64,...` já completo ou acrescentar o prefixo caso a resposta traga apenas base64. A forma concreta recebida no servidor contratado deve ganhar fixture de contrato antes da ativação.

### 3.4 Enviar texto

```http
POST /send/text
token: <instance token>
Content-Type: application/json
```

Corpo mínimo exato:

```json
{
  "number": "5511999999999",
  "text": "Olá!"
}
```

`number` e `text` são obrigatórios. Para contato brasileiro, a forma canônica documentada é `5511999999999`: dígitos com DDI `55`, sem `+`, espaços, pontuação ou sufixo. Não é necessário acrescentar `@s.whatsapp.net`. O endpoint também aceita explicitamente JID completo de usuário (`@s.whatsapp.net` ou `@lid`), grupo (`@g.us`) e newsletter (`@newsletter`). A aceitação de números com `+` não é especificada; por isso o adapter deve normalizar para o exemplo documentado. Fontes: [OpenAPI oficial](https://docs.uazapi.com/openapi-bundled.json) e [requisição Postman de texto](https://www.postman.com/augustofcs/uazapi-v2/request/69nsv0l/enviar-texto).

Na resposta, o schema `Message` define `messageid` como o ID original da mensagem no provedor e enumera como estados comuns `Queued`, `Canceled`, `Failed`, `Sent`, `Delivered` e `Read`. O `messageid` retornado deve ser salvo em `WhatsappOutbox.whatsappMessageId`. A aceitação HTTP/`Sent` nunca deve ser transformada em `delivered`; entrega e leitura dependem dos ACKs posteriores. Fonte: [OpenAPI oficial](https://docs.uazapi.com/openapi-bundled.json).

O campo opcional `track_id` aceita valores repetidos segundo o próprio schema. Portanto, ele pode carregar o `requestKey` para rastreabilidade, mas **não substitui** a idempotência do banco do SalonPass.

### 3.5 Webhook, mensagens recebidas e ACKs

Registro e inspeção:

```http
POST /webhook
GET /webhook
token: <instance token>
```

O contrato 2.1.1 lista estes eventos:

`connection`, `history`, `messages`, `messages_update`, `newsletter_messages`, `call`, `contacts`, `presence`, `groups`, `labels`, `chats`, `chat_labels`, `blocks`, `sender`.

- `messages`: novas mensagens recebidas; é o evento de entrada que deve virar `WhatsappInbound`.
- `messages_update`: atualização de mensagem existente; é o evento a observar para ACKs.
- O schema de `Message` confirma os estados `Delivered` e `Read`.

Fonte para registro, lista e significado dos eventos: [OpenAPI oficial](https://docs.uazapi.com/openapi-bundled.json). A coleção Postman também mostra `messages` e `messages_update` no [registro de webhook](https://www.postman.com/augustofcs/uazapi-v2/request/so8w6vz/definir-webhook).

Configuração proposta em modo avançado, para não correr o risco de o filtro de mensagens próprias também esconder seus ACKs:

```json
{
  "action": "add",
  "enabled": true,
  "url": "<UAZAPI_WEBHOOK_PUBLIC_URL>?secret=<UAZAPI_WEBHOOK_SECRET>",
  "events": ["messages"],
  "excludeMessages": ["wasSentByApi"],
  "addUrlEvents": false,
  "addUrlTypesMessages": false
}
```

```json
{
  "action": "add",
  "enabled": true,
  "url": "<UAZAPI_WEBHOOK_PUBLIC_URL>?secret=<UAZAPI_WEBHOOK_SECRET>",
  "events": ["messages_update", "connection"],
  "excludeMessages": [],
  "addUrlEvents": false,
  "addUrlTypesMessages": false
}
```

O modo avançado `action: add/update/delete`, os filtros e a recomendação de excluir `wasSentByApi` para impedir loops são documentados no [OpenAPI oficial](https://docs.uazapi.com/openapi-bundled.json).

**HIPÓTESE NÃO CONFIRMADA:** o OpenAPI 2.1.1 não especifica o envelope completo do callback nem o caminho exato dentro do JSON que contém `messageid`, `status` e timestamp em um `messages_update`. Também não documenta assinatura criptográfica ou header secreto enviado pela uazapi. Antes de ativar o webhook, obter do fornecedor ou capturar, em ambiente autorizado, fixtures sanitizadas reais de `messages`, `Delivered` e `Read`; até isso acontecer, o parser deve rejeitar formato desconhecido e nunca promover status por suposição.

Como defesa da aplicação, registrar a URL com um segredo aleatório de alta entropia (`UAZAPI_WEBHOOK_SECRET`) e validá-lo antes de ler/processar o corpo. Isso é uma proteção criada pelo SalonPass, não uma capacidade confirmada da uazapi. Redigir o segredo de logs e métricas.

### 3.6 Plano gratuito e limites

- **Confirmado:** existe um servidor público/gratuito ou demo em `https://free.uazapi.com`; o OpenAPI também oferece `api` como subdomínio conhecido. Fonte: [OpenAPI oficial](https://docs.uazapi.com/openapi-bundled.json).
- **Confirmado:** a documentação diz apenas que o servidor tem limite máximo de instâncias conectadas, responde `429` quando o limite global é atingido e que servidores gratuitos/demo podem ter restrições adicionais de tempo de vida. Fonte: [documentação oficial](https://docs.uazapi.com/).
- **HIPÓTESE NÃO CONFIRMADA:** não foi localizada fonte concreta que confirme um plano comercial gratuito persistente, diferente do servidor público/demo.
- **HIPÓTESE NÃO CONFIRMADA:** quantidade de mensagens por dia no free.
- **HIPÓTESE NÃO CONFIRMADA:** número de instâncias permitido por conta no free.

Consequência: o servidor `free` serve para prova técnica, não deve ser tratado como infraestrutura estável nem receber compromisso de SLA até o dono obter do fornecedor, por escrito, a duração da instância e os limites da conta. Não inserir no código números de quota inventados.

## 4. Leitura do repositório e interface que deve permanecer estável

### 4.1 Fachada pública atual

Em `apps/api/src/modules/whatsapp/whatsapp.service.ts`, consumidores usam estas assinaturas públicas e tipos associados; elas devem continuar disponíveis sem reescrever controllers, agendamentos, notificações, filas ou inbox:

```ts
setInboundHandler(fn: WhatsappInboundHandler): void
addInboundHandler(fn: WhatsappInboundHandler): () => void
addOutboundHandler(fn: WhatsappOutboundHandler): () => void
addDeliveryHandler(fn: WhatsappDeliveryHandler): () => void

resolveOpsCompanyId(companyId?: string): Promise<string | null>
setManagerPhone(companyId: string, phone: string): Promise<void>
getManagerPhone(companyId: string): Promise<string | null>
findCompanyByManagerDigits(fromDigits: string): Promise<string | null>
isManagerPhone(companyId: string, phone: string): Promise<boolean>

getStatus(companyId: string): {
  status: 'disabled' | 'connecting' | 'qr' | 'open' | 'closed'
  hasQr: boolean
  phone: string | null
}
getQrDataUrl(companyId: string): Promise<string | null>
ensureConnecting(companyId: string): void
requestPairingCode(companyId: string, phone: string): Promise<string | null>
logout(companyId: string): Promise<void>

enqueueText(phone: string, text: string, ctx?: {
  companyId?: string
  customerId?: string
  appointmentId?: string
  kind?: string
  requestKey?: string
  authorized?: boolean
  inboxMessageId?: string
  recipientJid?: string
  media?: {
    type: 'image' | 'audio' | 'document'
    url: string
    mimeType: string
    fileName?: string
    ptt?: boolean
  }
}): Promise<WhatsappEnqueueResult | null>

markMessagesRead(
  companyId: string,
  remoteJid: string,
  messageIds: string[],
): Promise<void>

nasceuNaVoltr(messageId: string): boolean
externalIdDaVoltr(messageId: string): string | undefined
```

`WhatsappInbound`, `WhatsappOutboundQueued`, `WhatsappEnqueueResult` e `WhatsappDeliveryUpdate` também fazem parte do contrato interno. Em particular, ambos os provedores devem normalizar ACKs para:

```ts
{
  companyId: string
  whatsappMessageId: string
  status: 'sent' | 'delivered' | 'read'
  at: Date
}
```

Como `getStatus()` é síncrono e uazapi é HTTP, o adapter deve manter um cache curto por empresa, atualizado por `ensureConnecting()`, `getQrDataUrl()`, polling de `GET /instance/status` e evento `connection`. Assim a assinatura pública não muda.

Mapeamento das operações de conexão da fachada no adapter uazapi:

- `getQrDataUrl` e `ensureConnecting`: `POST /instance/connect` seguido de `GET /instance/status` enquanto houver pareamento pendente;
- `requestPairingCode`: `POST /instance/connect` com `{"phone":"5511999999999"}`;
- `logout`: `POST /instance/disconnect`, que encerra e limpa a sessão e exige novo QR no próximo vínculo;
- `markMessagesRead`: `POST /chat/read` com `{"number":"5511999999999@s.whatsapp.net","read":true}`. A API opera no nível do chat; o adapter preserva a assinatura atual e só faz a chamada quando `messageIds` não estiver vazio.

Esses paths, métodos e corpos estão no [OpenAPI oficial 2.1.1](https://docs.uazapi.com/openapi-bundled.json). `setManagerPhone`, `getManagerPhone`, a busca reversa do gerente e os helpers Voltr continuam provider-agnostic e não chamam uazapi.

### 4.2 Separação interna proposta

1. **`WhatsappService` / fachada:** mantém API pública, outbox, política, idempotência, eventos normalizados, manager phone e integração Voltr.
2. **`WhatsappProviderResolver`:** resolve `whatsapp.provider` no backend por `companyId` e entrega `baileys` ou `uazapi`.
3. **`BaileysWhatsappProvider`:** recebe o código específico hoje embutido no serviço: sockets, QR, pairing, auth state, resolução JID e ACKs Baileys.
4. **`UazapiWhatsappProvider`:** cliente HTTP tipado, cache de conexão/QR, envio, marcar como lido e normalização dos webhooks.
5. **`WhatsappDeliveryReceiptService`:** persiste, de forma comum aos dois provedores, a progressão de `sent`/`delivered`/`read`.

A outbox nunca chama uma API pela lateral. O worker seleciona o provider na hora da entrega, revalida a autorização existente e só então chama o método interno de envio. Endpoints de webhook também não enviam resposta automática; apenas validam, normalizam e entregam aos handlers já registrados.

O boot que hoje reconecta sessões Baileys salvas deve ignorar empresas cujo `whatsapp.provider` seja `uazapi`, evitando dois clientes conectados para o mesmo número.

`resolveOpsCompanyId()` também precisa considerar a `Setting` uazapi quando não houver credenciais Baileys; `companyId` explícito continua tendo prioridade e deve ser obrigatório quando a resolução for ambígua.

### 4.3 Escolha por empresa

O schema já fornece:

- `FeatureFlag`: booleano por `companyId + key`; o `FeatureFlagsService` ignora chaves fora do catálogo. Serve para direito/entitlement, como `whatsapp_api`.
- `Setting`: JSON genérico por `companyId + key`; já é usado para `notifications.automation`, `notifications.followup` e `billing.details`.

Por isso, usar `Setting`, não criar uma FeatureFlag falsa de provider:

| Empresa | `Setting.key` | `valueJson` efetivo |
|---|---|---|
| `cmrxytgwg000hk001x485cp24` | `whatsapp.provider` | `{ "provider": "uazapi" }` somente na etapa de ativação |
| Qualquer outra | linha ausente | `{ "provider": "baileys" }` por default no backend |

Regras do resolver:

- somente valores permitidos (`baileys`, `uazapi`); falha fechada para `baileys` quando a linha não existe, antes de qualquer tentativa;
- se a empresa escolheu `uazapi`, mas faltam segredo/URL, não enviar e gravar erro honesto; não fazer fallback por mensagem;
- armazenar tokens apenas em secrets/env, nunca em `Setting.valueJson`, resposta HTTP ou frontend;
- não oferecer toggle no frontend no piloto; a alteração operacional da `Setting` é deliberada, auditável e feita somente após o checklist;
- preservar `whatsapp_api` e `WHATSAPP_ENABLED` como gates já existentes.

## 5. Autorização, idempotência e histórico

`apps/api/src/modules/whatsapp/outbox-policy.ts` já implementa a regra a preservar:

- automações: `confirmation`, `cancellation`, `reminder`, `followup`, `campaign`;
- padrão da empresa ou autorização específica do agendamento; `whatsappOptIn`/`notificationsEnabled` são travas adicionais, nunca autorização;
- revalidação no momento da entrega, expiração por tipo e teto para espera por conexão;
- `authorizedAt` registra autorização humana específica;
- `requestKey`, com `@@unique([companyId, requestKey])`, é a identidade durável da ação.

O `Setting` `notifications.automation` continua com tudo desligado por padrão, mantendo a exceção já existente `onlineBooking: true` no serviço de configurações. A introdução da uazapi não altera default, não liga automação e não transforma opt-in em autorização. O backend continua sendo a autoridade.

Em `WhatsappOutbox`, os estados válidos existentes são `pending`, `sent`, `delivered`, `read`, `failed`, `expired`. Mapeamento obrigatório:

| Fato | Estado SalonPass |
|---|---|
| Linha criada e autorizada | `pending` (“na fila”) |
| uazapi aceitou e devolveu `messageid` | `sent` |
| webhook `messages_update` confirmou `Delivered` | `delivered` |
| webhook `messages_update` confirmou `Read` | `read` |
| erro final após política de retentativa | `failed` |
| política invalidou/venceu antes do envio | `expired` |

`track_id = requestKey` pode ser enviado apenas para correlação. A deduplicação continua sendo feita antes da chamada externa pela unique `companyId + requestKey` e pelas proteções atuais da outbox.

## 6. Correção da lacuna de `delivered` / `read`

### 6.1 Falha atual confirmada

O Baileys em `whatsapp.service.ts` escuta `messages.update` e `message-receipt.update`, normaliza `sent`/`delivered`/`read` e chama `emitDeliveryUpdate`. O consumidor `WhatsappInboxService.captureDeliveryUpdate()` atualiza **somente** `WhatsappInboxMessage` (`status`, `sentAt`, `deliveredAt`, `readAt`). Não existe atualização correspondente de `WhatsappOutbox`.

Resultado atual: a conversa pode mostrar entregue/lido, enquanto a outbox permanece `sent`. A suspeita está confirmada.

### 6.2 Persistência comum proposta

Antes de ativar uazapi, criar um handler durável e provider-agnostic de ACK:

1. Receber `WhatsappDeliveryUpdate` normalizado de Baileys ou uazapi.
2. Buscar/correlacionar por `companyId + whatsappMessageId`.
3. Em transação, atualizar `WhatsappOutbox` e o `WhatsappInboxMessage` outbound vinculado.
4. Aplicar progressão monotônica `pending < sent < delivered < read`; webhook repetido é no-op, e evento fora de ordem nunca rebaixa `read` para `delivered`/`sent`.
5. Não ressuscitar `failed` ou `expired` por ACK tardio; registrar o caso para investigação.
6. Não aceitar ACK de outra empresa, instância ou provider.

Alteração de schema recomendada para a implementação futura:

- adicionar `deliveredAt DateTime?` e `readAt DateTime?` a `WhatsappOutbox`, pois hoje só existe `sentAt`;
- adicionar índice (preferivelmente unique se os dados históricos permitirem) em `[companyId, whatsappMessageId]` para correlação e proteção contra ambiguidade;
- manter os timestamps equivalentes de `WhatsappInboxMessage` na mesma transação.

Se a migração de timestamps precisar ser adiada, a primeira entrega ainda deve atualizar ao menos `WhatsappOutbox.status`; os timestamps ficam provisoriamente no inbox. Isso corrige a honestidade do status sem confundir “enviado” com “entregue”.

No webhook uazapi, somente `messages_update` validado pode promover para `delivered`/`read`. `POST /send/text` promove no máximo para `sent`, depois de obter e persistir `messageid`.

## 7. Variáveis de ambiente e segredos a pedir ao dono

Obrigatórias para o piloto:

| Nome exato | Secreto? | Conteúdo |
|---|---:|---|
| `UAZAPI_BASE_URL` | não | host exato da conta/servidor, sem path final; exemplo confirmado `https://free.uazapi.com` |
| `UAZAPI_INSTANCE_TOKEN` | sim | token da única instância da La Belle de Jour; vai no header `token` |
| `UAZAPI_WEBHOOK_PUBLIC_URL` | não | URL HTTPS pública completa do endpoint SalonPass para o callback, antes do segredo |
| `UAZAPI_WEBHOOK_SECRET` | sim | valor aleatório forte gerado pelo SalonPass, incorporado à URL registrada e validado pelo backend |

Opcional, e recomendado **não** colocar no runtime do piloto:

| Nome exato | Secreto? | Quando é necessário |
|---|---:|---|
| `UAZAPI_ADMIN_TOKEN` | sim | somente se o SalonPass for autorizado a executar `POST /instance/create`; vai no header `admintoken` |

Não pedir `UAZAPI_API_KEY` nem `UAZAPI_INSTANCE_ID`: são nomes do MCP comunitário e não do OpenAPI oficial 2.1.1. `WHATSAPP_ENABLED` já é gate existente do sistema, não uma credencial nova da uazapi.

Todos os segredos devem ficar no secret manager do ambiente, ser redigidos de logs e nunca aparecer no plano de banco, no frontend ou em exceptions. A URL base deve ser validada como HTTPS e não ser controlável por usuário para evitar SSRF.

## 8. Ordem de implementação e rollout seguro

### Fase A — pode subir primeiro sem risco de envio

1. Adicionar testes de contrato baseados no OpenAPI e fixtures artificiais; nenhum request externo.
2. Criar a abstração de provider e mover Baileys para ela preservando 100% da fachada; resolver ausente como Baileys.
3. Criar o reader backend de `Setting('whatsapp.provider')`, mantendo a linha da La Belle ainda ausente.
4. Implementar o persistidor comum de ACK e fazê-lo atender primeiro aos ACKs Baileys; incluir migração aditiva de timestamps/índice e testes de monotonicidade.
5. Adicionar o cliente uazapi e o endpoint de webhook atrás de configuração ausente, com mock HTTP, validação de schema, limite de corpo, segredo e logs sem credenciais.
6. Testar: autenticação pelos headers exatos, corpo mínimo, timeouts, `429`, `5xx`, resposta sem `messageid`, webhook duplicado, ACK fora de ordem, empresa errada e formato desconhecido.

Esses itens podem ir a produção sem token uazapi, sem registro de webhook e sem `Setting` da La Belle; o comportamento efetivo permanece Baileys.

### Fase B — provisionamento, ainda sem enviar

7. O dono cria a instância uazapi e fornece host + Instance Token; usar `admintoken` no SalonPass somente se ele solicitar explicitamente automação da criação.
8. Inserir os secrets no ambiente e validar apenas `GET /instance/status`; não conectar automaticamente no boot.
9. Publicar o webhook seguro, registrar `messages`, `messages_update` e `connection` e obter fixtures sanitizadas do formato real. O parser só é liberado após confirmar `messageid`, status, timestamp, empresa/instância e reentrega.
10. Revisar no banco o backlog `pending` da La Belle. Não drenar; expirar/segregar itens antigos conforme a política existente. Registrar a configuração anterior para rollback.
11. Com autorização expressa do dono para parear o número, gerar QR/pairing code e garantir que o socket Baileys dessa empresa esteja parado. Isso não autoriza mensagens.

### Fase C — ativação controlada

12. Criar `Setting('whatsapp.provider') = {"provider":"uazapi"}` somente para `cmrxytgwg000hk001x485cp24`; confirmar que todas as outras empresas continuam Baileys.
13. Manter automações no estado atual, por padrão desligado; não ligar confirmation/reminder/follow-up como parte da troca de provider.
14. Somente após autorização posterior do dono para um destinatário exato, realizar no máximo um envio manual com `authorizedAt` e `requestKey` únicos. Esse teste não faz parte desta tarefa.
15. Conferir a sequência real `pending -> sent -> delivered -> read` (quando o destinatário fornecer recibo), correlação no outbox/inbox e ausência de duplicata.

### Rollback

- Parar novas entregas da empresa, sem reexecutar mensagens de resultado incerto.
- Inspecionar outbox por `requestKey`/`whatsappMessageId` e webhook antes de decidir retentativa.
- Alterar a `Setting` para `baileys` ou removê-la somente após encerrar/desconectar a instância uazapi e obter autorização de novo pareamento Baileys.
- Nunca usar fallback automático para “tentar nos dois”.

## 9. Critérios de aceite do piloto

- A fachada pública acima não muda e nenhum consumidor precisa conhecer o provider.
- Só `cmrxytgwg000hk001x485cp24` resolve para uazapi; ausência de Setting continua Baileys.
- Não há caminho de envio que contorne `enqueueText`, `requestKey`, `authorizedAt` e a revalidação de `outbox-policy.ts`.
- Um retorno de envio registra `sent`, nunca `delivered`.
- `Delivered` e `Read` do webhook atualizam `WhatsappOutbox` e `WhatsappInboxMessage` em ordem monotônica e de forma idempotente.
- Webhook desconhecido ou sem segredo válido não altera estado.
- Nenhum segredo chega ao frontend ou aos logs.
- A ativação não conecta/drena backlog e não liga automações.
- Limites do free permanecem documentados como desconhecidos até confirmação formal da uazapi.
