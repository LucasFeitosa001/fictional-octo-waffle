-- Permite sobrescrever, por agendamento, os padrões da empresa para as
-- mensagens de horário marcado/confirmado e cancelamento.
ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "notifyConfirmation" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "notifyCancellation" BOOLEAN;
