-- Deep-link do sino: guardar o id da entidade que a notificação referencia
-- (appointmentId em type "appointment.*", ampliável para outros tipos).
ALTER TABLE "Notification" ADD COLUMN "entityId" TEXT;

CREATE INDEX "Notification_entityId_idx" ON "Notification"("entityId");
