-- AlterTable
ALTER TABLE "CashMovement" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "CashRegister" ADD COLUMN     "closedByUserId" TEXT,
ADD COLUMN     "divergence" DECIMAL(12,2),
ADD COLUMN     "expectedBalance" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "additionalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "defaultCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "employeePrice" DECIMAL(12,2),
ADD COLUMN     "itemCode" TEXT,
ADD COLUMN     "observation" TEXT,
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "unitEquivalence" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "reversalOfId" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

