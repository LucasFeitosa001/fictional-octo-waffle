-- Customer-facing auth + public booking portal support.

-- AlterTable: distinguish staff vs. customer Better Auth accounts.
ALTER TABLE "User" ADD COLUMN "accountType" TEXT NOT NULL DEFAULT 'staff';

-- AlterTable: optionally link a Customer record to the logged-in User who booked.
ALTER TABLE "Customer" ADD COLUMN "userId" TEXT;

-- Indexes / constraints for the new Customer.userId link.
CREATE UNIQUE INDEX "Customer_companyId_userId_key" ON "Customer"("companyId", "userId");
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
