-- Pagamento de comissão passa a saber COMO e DE ONDE o dinheiro saiu, para
-- virar despesa no Financeiro. Tudo aditivo e nullable: os pagamentos já
-- registrados continuam válidos, apenas sem forma/conta.
DO $$ BEGIN
  CREATE TYPE "CommissionPaymentRail" AS ENUM ('manual', 'salonpay');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "CommissionPayment" ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT;
ALTER TABLE "CommissionPayment" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "CommissionPayment" ADD COLUMN IF NOT EXISTS "transactionId" TEXT;
ALTER TABLE "CommissionPayment" ADD COLUMN IF NOT EXISTS "rail" "CommissionPaymentRail" NOT NULL DEFAULT 'manual';

DO $$ BEGIN
  ALTER TABLE "CommissionPayment"
    ADD CONSTRAINT "CommissionPayment_paymentMethodId_fkey"
    FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommissionPayment"
    ADD CONSTRAINT "CommissionPayment_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cadastro de recebimento do SalonPay (um por empresa).
DO $$ BEGIN
  CREATE TYPE "SalonPayPersonType" AS ENUM ('individual', 'company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SalonPayStatus" AS ENUM ('pending', 'active', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SalonPayAccount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "status" "SalonPayStatus" NOT NULL DEFAULT 'pending',
  "personType" "SalonPayPersonType" NOT NULL DEFAULT 'company',
  "legalName" TEXT,
  "companyType" TEXT,
  "taxId" TEXT,
  "revenue" DECIMAL(14,2),
  "ownerName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "zipCode" TEXT,
  "street" TEXT,
  "number" TEXT,
  "district" TEXT,
  "city" TEXT,
  "state" TEXT,
  "complement" TEXT,
  "acceptPix" BOOLEAN NOT NULL DEFAULT true,
  "acceptCard" BOOLEAN NOT NULL DEFAULT true,
  "providerAccountId" TEXT,
  "statusReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalonPayAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalonPayAccount_companyId_key" ON "SalonPayAccount"("companyId");
CREATE INDEX IF NOT EXISTS "SalonPayAccount_companyId_idx" ON "SalonPayAccount"("companyId");

DO $$ BEGIN
  ALTER TABLE "SalonPayAccount"
    ADD CONSTRAINT "SalonPayAccount_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
