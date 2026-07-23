-- AlterTable
ALTER TABLE "WhatsappOutbox" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "kind" TEXT;

-- CreateIndex
CREATE INDEX "WhatsappOutbox_companyId_idx" ON "WhatsappOutbox"("companyId");

-- CreateIndex
CREATE INDEX "WhatsappOutbox_customerId_idx" ON "WhatsappOutbox"("customerId");

-- AddForeignKey
ALTER TABLE "WhatsappOutbox" ADD CONSTRAINT "WhatsappOutbox_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappOutbox" ADD CONSTRAINT "WhatsappOutbox_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
