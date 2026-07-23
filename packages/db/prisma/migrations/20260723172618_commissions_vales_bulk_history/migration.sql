-- CreateEnum
CREATE TYPE "CommissionAdvanceStatus" AS ENUM ('open', 'deducted');

-- AlterTable
ALTER TABLE "CommissionEntry" ADD COLUMN     "paymentId" TEXT;

-- AlterTable
ALTER TABLE "CommissionPayment" ADD COLUMN     "advancesTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "bonusTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "commissionTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "paidByUserId" TEXT;

-- CreateTable
CREATE TABLE "CommissionAdvance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "status" "CommissionAdvanceStatus" NOT NULL DEFAULT 'open',
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionAdvance_companyId_idx" ON "CommissionAdvance"("companyId");

-- CreateIndex
CREATE INDEX "CommissionAdvance_professionalId_idx" ON "CommissionAdvance"("professionalId");

-- CreateIndex
CREATE INDEX "CommissionAdvance_paymentId_idx" ON "CommissionAdvance"("paymentId");

-- CreateIndex
CREATE INDEX "CommissionEntry_paymentId_idx" ON "CommissionEntry"("paymentId");

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CommissionPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAdvance" ADD CONSTRAINT "CommissionAdvance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAdvance" ADD CONSTRAINT "CommissionAdvance_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAdvance" ADD CONSTRAINT "CommissionAdvance_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CommissionPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
