-- Transferências do SalonPay (repasse de comissão) + chave PIX da profissional.
-- Tudo aditivo: nenhuma coluna existente muda, nenhum dado é reescrito.
DO $$ BEGIN
  CREATE TYPE "SalonPayOperation" AS ENUM ('commission', 'withdrawal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SalonPayTransferStatus" AS ENUM ('pending', 'processing', 'paid', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "pixKey" TEXT;

CREATE TABLE IF NOT EXISTS "SalonPayTransfer" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "paymentId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settledAt" TIMESTAMP(3),
  "operation" "SalonPayOperation" NOT NULL DEFAULT 'commission',
  "status" "SalonPayTransferStatus" NOT NULL DEFAULT 'pending',
  "statusReason" TEXT,
  "recipientName" TEXT NOT NULL,
  "recipientDocument" TEXT,
  "pixKey" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalonPayTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SalonPayTransfer_companyId_idx" ON "SalonPayTransfer"("companyId");
CREATE INDEX IF NOT EXISTS "SalonPayTransfer_professionalId_idx" ON "SalonPayTransfer"("professionalId");
CREATE INDEX IF NOT EXISTS "SalonPayTransfer_paymentId_idx" ON "SalonPayTransfer"("paymentId");

DO $$ BEGIN
  ALTER TABLE "SalonPayTransfer" ADD CONSTRAINT "SalonPayTransfer_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SalonPayTransfer" ADD CONSTRAINT "SalonPayTransfer_professionalId_fkey"
    FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SalonPayTransfer" ADD CONSTRAINT "SalonPayTransfer_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "CommissionPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
