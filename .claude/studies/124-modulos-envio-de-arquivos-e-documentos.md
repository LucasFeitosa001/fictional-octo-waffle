# Estudo 124 — os módulos "Envio de imagens e arquivos" e "Gerador de documentos"

Pedido do dono em 05/08, colando o texto exato dos dois cards da tela de
Adicionais:

> **Envio de imagens e arquivos** — Mandar fotos de referência e documentos para
> a cliente junto das mensagens do salão. *Adicional · valor combinado no suporte*
>
> **Gerador de documentos** — Contratos, termos e recibos preenchidos com os
> dados do cliente e do atendimento. *Adicional · valor combinado no suporte*

Os dois estavam na vitrine do estudo 122 como "ainda não existe". Ele pediu para
CRIAR — e criar só a chave, sem a funcionalidade, seria a feature decorativa que
aquela tela veio corrigir.

## Arquivos tocados

- `apps/api/src/modules/feature-flags/feature-catalog.ts`
- `apps/api/src/modules/whatsapp/whatsapp.service.ts`
- `apps/api/src/modules/whatsapp/whatsapp.controller.ts`
- `apps/api/src/modules/whatsapp/whatsapp.module.ts`
- `apps/web/src/lib/queries/features.ts`
- `apps/web/src/lib/queries/whatsappMedia.ts` (novo)
- `apps/web/src/pages/ClientePerfilTabs.tsx`

## O que JÁ existia (e por isso o módulo 1 é pequeno)

A conclusão que mudou o tamanho do trabalho: quase tudo estava pronto, em partes
que nunca tinham sido ligadas uma na outra.

- `apps/web/src/pages/ClientePerfilTabs.tsx:2614` — a ficha do cliente já tem a
  aba **"Imagens e Arquivos"** (`ImagensTab`, :2255). Ela sobe arquivo
  (`useUploadImage` + `useCreateCustomerFile`), lista em galeria, baixa e exclui.
  O que ela NUNCA fez foi mandar nada para a cliente — exatamente o verbo do
  card ("mandar … junto das mensagens do salão").
- `apps/api/src/modules/uploads/uploads.controller.ts:64` — upload multipart com
  `FileInterceptor` + S3, devolvendo `{ url, key }`.
- `apps/api/src/modules/whatsapp/whatsapp.service.ts:881` — `enqueueText` já
  aceita `ctx.media` com `{ type, url, mimeType, fileName }`.
- `whatsapp.service.ts:1411-1425` — o remetente já sabia mandar `image` e
  `audio`.
- `packages/db/prisma/schema.prisma:2313-2317` — `WhatsappOutbox` já tem
  `mediaType`, `mediaUrl`, `mediaMimeType`, `mediaFileName`. **Sem migração.**

Faltavam três coisas: o tipo `document` no remetente, uma rota que o painel
pudesse chamar, e o botão.

## O que este estudo muda

### Catálogo

Duas chaves novas em `FEATURE_KEYS`: `media_messages` e `documents`, com
`FEATURE_META` copiando ao pé da letra o texto que o dono publicou na tela — quem
contratar leu aquilo, então é aquilo que o módulo deve entregar.

Ambas entram em `MAX_FEATURES` porque todo módulo precisa de um lar no catálogo,
mas a venda é como **adicional avulso**: a tela de Adicionais os oferece por
"valor combinado no suporte", e a ativação por empresa é um override de
`FeatureFlag`. Quem está no Starter ou no Pro não precisa subir de plano.

O front tem sua própria cópia da lista (`apps/web/src/lib/queries/features.ts:10`,
usada por `useFeatures()` para tipar `features: FeatureKey[]`). As duas listas
precisam andar juntas — sem a chave lá, o `includes('media_messages')` nem
compila.

### Módulo 1 — Envio de imagens e arquivos

- `whatsapp.service.ts`: `type` do enqueue passa a aceitar `'document'`, e o
  remetente ganha o ramo com `fileName` (sem ele o aparelho mostra um anexo sem
  nome, que ninguém abre). O tipo do **inbound** ficou como estava — mídia
  RECEBIDA continua `image|audio`, que é o que `voltr-forwarder.service.ts:171`
  consome.
- `WhatsappMediaController` (`POST /whatsapp/media`), com
  `@RequireFeature('media_messages')`. O telefone vem do **cadastro**, nunca do
  corpo da requisição: aceitar número solto abriria envio para qualquer
  destinatário a partir de uma sessão válida.
- `authorized: true` porque é uma PESSOA clicando, com o arquivo escolhido — a
  mesma isenção do botão "Enviar confirmação" (estudo 60). A regra permanente do
  projeto continua de pé: nada dispara sozinho.
- Na aba, um botão de enviar por arquivo (só aparece com o módulo ativo) abre um
  drawer com o nome do arquivo e um recado opcional. O retorno é honesto: **"na
  fila"**, não "entregue".

### Módulo 2 — Gerador de documentos

Segue no mesmo commit apenas como chave de catálogo; a implementação vem em
seguida, e até lá o módulo NÃO é oferecido como pronto.
