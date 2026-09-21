-- Arquivar conversas antigas por troca de número pareado (estudo 11).
--
-- Aditiva e idempotente. Nullable de propósito: registros sem archivedAt
-- continuam aparecendo no inbox; um UPDATE explícito marca as antigas quando
-- o dono trocar o WhatsApp do salão.

ALTER TABLE "WhatsappConversation" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
