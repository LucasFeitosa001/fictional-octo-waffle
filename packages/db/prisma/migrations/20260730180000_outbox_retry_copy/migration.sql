-- Estudo 69: cópia persistente da mensagem enviada, para responder ao pedido de
-- reenvio do WhatsApp ("Aguardando mensagem") mesmo depois de a API reiniciar.
ALTER TABLE "WhatsappOutbox" ADD COLUMN IF NOT EXISTS "whatsappMessageId" TEXT;
ALTER TABLE "WhatsappOutbox" ADD COLUMN IF NOT EXISTS "sentMessageJson" JSONB;
CREATE INDEX IF NOT EXISTS "WhatsappOutbox_whatsappMessageId_idx"
  ON "WhatsappOutbox" ("companyId", "whatsappMessageId");
