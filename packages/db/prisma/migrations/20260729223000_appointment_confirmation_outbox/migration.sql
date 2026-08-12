-- Vincula cada confirmação ao agendamento e torna retries HTTP idempotentes.
ALTER TABLE "WhatsappOutbox"
  ADD COLUMN "appointmentId" TEXT,
  ADD COLUMN "requestKey" TEXT;

CREATE INDEX "WhatsappOutbox_appointmentId_idx"
  ON "WhatsappOutbox"("appointmentId");

CREATE UNIQUE INDEX "WhatsappOutbox_companyId_requestKey_key"
  ON "WhatsappOutbox"("companyId", "requestKey");
