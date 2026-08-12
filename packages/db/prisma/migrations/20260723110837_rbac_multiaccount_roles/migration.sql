-- RBAC + multi-conta: papel com código estável + flag de sistema, e empresa
-- ativa por sessão. Escrito para ser idempotente/seguro em bancos com dados:
-- `code` é NOT NULL, então adicionamos com DEFAULT temporário, fazemos backfill
-- das linhas existentes e só então removemos o DEFAULT + criamos o índice único.

-- Session: empresa ativa da sessão (String simples, sem FK).
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "activeCompanyId" TEXT;

-- Role.isSystem (default false já cobre linhas existentes).
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- Role.code: adiciona com DEFAULT temporário '' para não quebrar linhas existentes.
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "code" TEXT NOT NULL DEFAULT '';

-- Backfill idempotente do code das roles existentes:
--   * roles chamadas 'Administrador' viram o papel 'owner';
--   * qualquer outra recebe um slug do name (minúsculo, não-alfanumérico -> '_').
-- Só toca linhas ainda sem code (= '') para poder re-rodar sem sobrescrever.
UPDATE "Role"
SET "code" = 'owner', "isSystem" = true
WHERE "code" = '' AND lower("name") = 'administrador';

UPDATE "Role"
SET "code" = regexp_replace(lower("name"), '[^a-z0-9]+', '_', 'g')
WHERE "code" = '';

-- Garante unicidade de code por empresa mesmo se dois names gerarem o mesmo slug:
-- desempata anexando um sufixo curto do id. (No-op quando não há colisão.)
UPDATE "Role" r
SET "code" = r."code" || '_' || right(r."id", 6)
WHERE EXISTS (
  SELECT 1 FROM "Role" o
  WHERE o."companyId" = r."companyId" AND o."code" = r."code" AND o."id" < r."id"
);

-- Remove o DEFAULT temporário: novos inserts devem informar o code explicitamente.
ALTER TABLE "Role" ALTER COLUMN "code" DROP DEFAULT;

-- Índice único (companyId, code).
CREATE UNIQUE INDEX IF NOT EXISTS "Role_companyId_code_key" ON "Role"("companyId", "code");
