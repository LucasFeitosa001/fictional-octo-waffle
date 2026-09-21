# Arquivar conversas antigas do WhatsApp inbox por troca de número pareado

## Contexto
Barbearia Paulista (`company_barbeariapaulsia_...`) trocou o número do WhatsApp pareado: antes o número do Lucas (`558981312500`) estava conectado como sender do salão; agora o Erisvaldo (`5519994737925`) foi pareado via uazapi. O inbox continua exibindo as 6 conversas antigas porque `listConversations` filtra só por `companyId`.

## Código atual

- `packages/db/prisma/schema.prisma:2206-2231` — `model WhatsappConversation` sem coluna para arquivamento; índices por `(companyId, lastMessageAt)` e `(companyId, resolved)`.
- `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:348-388` — `listConversations` faz `findMany({ where: { companyId, ...status/q } })`. Suporta `status` = `unread | resolved | open`.
- `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.controller.ts:52-58` — repassa `q` e `status` do query string sem validação forte.
- Banco de prod (Setting da Paulista): `whatsapp.provider = { provider: "uazapi" }`; `platform.Empresa.waNumero` foi atualizado agora para `5519994737925`.

## Arquivos a mexer
1. `packages/db/prisma/schema.prisma` — adicionar `archivedAt DateTime?` em `WhatsappConversation`.
2. `packages/db/prisma/migrations/20260919200000_add_archived_at_to_whatsapp_conversation/migration.sql` — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);` (aditiva, idempotente, mesmo padrão da 20260902000000 pra não brigar com o drift do histórico local vs prod).
3. `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts` — em `listConversations`, adicionar `archivedAt: null` por padrão no `where`, e tratar `status === 'archived'` retornando `archivedAt: { not: null }`.
4. `apps/web/src/lib/queries/whatsappInbox.ts` — tipagem do status é implícita (query string); nada a mudar de tipo obrigatoriamente.

## Impacto e reversibilidade
- Migration só adiciona coluna nullable — não bloqueia writes existentes.
- Filtro `archivedAt: null` no default é backward-safe: registros antigos (sem archivedAt) continuam aparecendo até um UPDATE explícito marcar `archivedAt = now()` nas 6 linhas da Paulista.
- Rollback = `ALTER TABLE ... DROP COLUMN "archivedAt";` (a fila de conversas volta a mostrar o histórico).

## Fora de escopo
- Gravar "com que número o bot recebeu" nas mensagens novas (proposto pra segundo passo).
- Endpoint pra desarquivar.
