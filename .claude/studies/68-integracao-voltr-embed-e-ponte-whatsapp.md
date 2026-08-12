# Estudo 68 — Integração com a Voltr: embed do CRM e ponte de WhatsApp

Pedido do dono: puxar a branch nova do repositório da Voltr (`llm-ecom-belivin`), rodar, ler a
documentação de integração e **seguir até fechar**.

## 68.1 — O que existe do outro lado (verificado rodando)

Branch `feat/voltr-plataforma-integracoes`, commit `986d94b`. Subi a API e o painel:

```
Voltr API  http://localhost:3001/api   (health 200)   ← o tutorial diz 3011; o .env real usa 3001
Voltr Web  http://localhost:3000
```

Rotas relevantes no ar: `POST /api/embed/token`, `POST /api/ingest/{mensagem,status,contatos,fotos,
audio,reset}`, `GET|PATCH /api/plataforma/{modulos,connector}`.

Provisionei o ambiente (era o que faltava para qualquer teste):

- `.env` da Voltr não tinha `EMBED_CLIENT_ID/SECRET/FRAME_ANCESTORS/BASE_URL` — sem eles o embed é
  **fail-closed** (403 "Embed não habilitado neste ambiente", `embed.service.ts:125`-`:129`).
- O banco de plataforma estava numa versão anterior: `platform.Empresa` não tinha `modulos`,
  `connectorEnabled`, `connectorWebhookUrl`, `connectorSecret` nem `embedOrigins`. `prisma db push`
  no schema de plataforma resolveu.
- O mapa `modulos` **não é** `{crm: true}`: `moduloLiberado` (`modules.catalog.ts:181`-`:199`) exige
  `{ active: true, paid: true }` (ou `trialUntil` no futuro). Com o formato certo, a troca de token
  passou a devolver `accessToken`/`expiresIn: 900`/`embedUrl`.

## 68.2 — O que NÃO existe do nosso lado

O tutorial (`docs/INTEGRACAO-SALONPASS.md`) descreve o lado SalonPass como pronto, citando
`apps/api/src/modules/voltr/*` e `apps/web/src/pages/VoltrCrmPage.tsx`. **Nada disso existe aqui**:

```
grep -rl voltr apps/api/src apps/web/src   → vazio
git log --all -- '*voltr*'                 → vazio
branches remotas: origin/main, origin/feat/belasis-etapa2, old-origin/…
```

Está apenas na cópia local do outro dev. Como o contrato está documentado endpoint a endpoint, este
estudo implementa o nosso lado a partir do contrato.

## 68.3 — Onde encaixa no que já temos

- **Inbound:** `WhatsappService` já suporta VÁRIOS consumidores —
  `addInboundHandler(fn)` (`whatsapp.service.ts:335`-`:338`) devolve um "cancelar" e os handlers são
  chamados em série (`:448`-`:456`). O fluxo de agendamento usa `setInboundHandler`; o encaminhador
  da Voltr entra como consumidor ADICIONAL, sem substituir ninguém.
- `WhatsappInbound` (`:73`-`:94`) já traz `companyId` (cada salão tem seu socket), `fromDigits`,
  `text`, `messageId` — é tudo o que o `POST /api/ingest/mensagem` pede.
- **Outbound:** o envio entra pelo `enqueueText` com `kind: 'voltr_outbound'`. Pelas travas do
  estudo 60, esse tipo **não** é automação: não é bloqueado com o canal fechado e não expira — é
  resposta de atendente/IA numa conversa viva, com status devolvido depois por
  `POST /api/ingest/status`. A semântica bate com a que a Voltr espera:
  `{ ok: true, acked: false }` = enfileirado.
- **Assinatura:** o webhook da Voltr assina o rawBody com HMAC-SHA256 por tenant. Nosso `main.ts`
  hoje faz `express.json()` sem guardar o buffer cru — sem isso não há como validar. Entra um
  `verify` que guarda o raw APENAS no caminho `/api/v1/voltr/whatsapp/`.

## 68.4 — O que este estudo implementa

- `apps/api/src/modules/voltr/voltr.config.ts` — env + mapa `Company.id ↔ slug` e resolução de
  token/segredo por tenant (com fallback global).
- `apps/api/src/modules/voltr/voltr.service.ts` — troca de token servidor-a-servidor
  (`x-embed-client/secret/ts/nonce`), encaminhamento do inbound e envio de status.
- `apps/api/src/modules/voltr/voltr.controller.ts` — `GET /voltr/embed-token` (sessão do painel) e
  `POST /voltr/whatsapp/send` (webhook da Voltr).
- `apps/api/src/modules/voltr/voltr-signature.guard.ts` — valida o HMAC em tempo constante,
  fail-closed.
- `apps/api/src/modules/voltr/voltr-forwarder.service.ts` — encaminha o inbound do Baileys para a
  Voltr (fire-and-forget, nunca derruba o fluxo de agendamento).
- `apps/api/src/modules/voltr/voltr.module.ts` + registro em `apps/api/src/app.module.ts`;
  `apps/api/src/main.ts` guarda o rawBody só no caminho do webhook.
- `apps/web/src/pages/VoltrCrmPage.tsx` + rotas `/voltr-crm` e `/voltr-chat` em
  `apps/web/src/App.tsx` + item em `apps/web/src/layout/Sidebar.tsx`.
- `apps/api/src/modules/usecase-tests/voltr.usecases.test.ts` — certificação da política
  (assinatura, mapa de tenant, fail-closed) e registro em `run-usecases.ts`.

Segredos ficam só em `.env` (com backup do arquivo antes de mexer), nunca no código.
