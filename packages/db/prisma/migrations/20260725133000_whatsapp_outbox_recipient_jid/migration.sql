-- Mantém o destinatário real do WhatsApp para chats LID e respostas do inbox.
ALTER TABLE "WhatsappOutbox"
  ADD COLUMN "toJid" TEXT;

CREATE INDEX "WhatsappOutbox_companyId_toJid_idx"
  ON "WhatsappOutbox"("companyId", "toJid");
