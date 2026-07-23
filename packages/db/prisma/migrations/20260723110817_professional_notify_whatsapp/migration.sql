-- Regulariza no histórico a coluna Professional.notifyWhatsapp, que já existia no
-- banco dev (aplicada anteriormente via db push, sem migração). IF NOT EXISTS
-- torna a migração idempotente: em bancos onde a coluna já existe (dev) nada muda;
-- em bancos limpos ela é criada. Marcada como aplicada via `migrate resolve` no dev.
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT true;
