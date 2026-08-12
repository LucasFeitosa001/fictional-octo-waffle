-- Estudo 60: marca a linha que uma PESSOA autorizou explicitamente (botão
-- "Enviar confirmação", sugestão de horário). NULL = automação, que passa a ser
-- revalidada na hora de entregar. Aditiva e nullable: linhas antigas seguem
-- válidas e são tratadas como automação.
ALTER TABLE "WhatsappOutbox" ADD COLUMN IF NOT EXISTS "authorizedAt" TIMESTAMP(3);
