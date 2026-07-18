-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "legacyId" TEXT,
ADD COLUMN     "legacySource" TEXT;

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "defaultDiscountPercent" DECIMAL(5,2),
ADD COLUMN     "legacyId" TEXT,
ADD COLUMN     "legacySource" TEXT,
ADD COLUMN     "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onlineAccessBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referredById" TEXT,
ADD COLUMN     "rg" TEXT,
ADD COLUMN     "smsOptIn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whatsappOptIn" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CustomerPackage" ADD COLUMN     "legacyId" TEXT,
ADD COLUMN     "legacySource" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "legacyId" TEXT,
ADD COLUMN     "legacySource" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "legacyId" TEXT,
ADD COLUMN     "legacySource" TEXT;

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "legacyId" TEXT,
ADD COLUMN     "legacySource" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "legacyId" TEXT,
ADD COLUMN     "legacySource" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "legacyId" TEXT,
ADD COLUMN     "legacySource" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "legacyId" TEXT,
ADD COLUMN     "legacySource" TEXT;

-- CreateTable
CREATE TABLE "CustomerDependent" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "dependentCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerDependent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTag" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSocialProfile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSocialProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDebt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "origin" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerDebt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDebtPayment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT,

    CONSTRAINT "CustomerDebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CustomerToCustomerTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CustomerToCustomerTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "CustomerDependent_customerId_idx" ON "CustomerDependent"("customerId");

-- CreateIndex
CREATE INDEX "CustomerDependent_dependentCustomerId_idx" ON "CustomerDependent"("dependentCustomerId");

-- CreateIndex
CREATE INDEX "CustomerTag_companyId_idx" ON "CustomerTag"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTag_companyId_name_key" ON "CustomerTag"("companyId", "name");

-- CreateIndex
CREATE INDEX "CustomerSocialProfile_customerId_idx" ON "CustomerSocialProfile"("customerId");

-- CreateIndex
CREATE INDEX "CustomerDebt_companyId_idx" ON "CustomerDebt"("companyId");

-- CreateIndex
CREATE INDEX "CustomerDebt_customerId_idx" ON "CustomerDebt"("customerId");

-- CreateIndex
CREATE INDEX "CustomerDebtPayment_debtId_idx" ON "CustomerDebtPayment"("debtId");

-- CreateIndex
CREATE INDEX "_CustomerToCustomerTag_B_index" ON "_CustomerToCustomerTag"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_companyId_legacyId_key" ON "Appointment"("companyId", "legacyId");

-- CreateIndex
CREATE INDEX "Customer_referredById_idx" ON "Customer"("referredById");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_legacyId_key" ON "Customer"("companyId", "legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPackage_companyId_legacyId_key" ON "CustomerPackage"("companyId", "legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_legacyId_key" ON "Order"("companyId", "legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_legacyId_key" ON "Product"("companyId", "legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Professional_companyId_legacyId_key" ON "Professional"("companyId", "legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_companyId_legacyId_key" ON "Service"("companyId", "legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_companyId_legacyId_key" ON "Supplier"("companyId", "legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_companyId_legacyId_key" ON "Transaction"("companyId", "legacyId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDependent" ADD CONSTRAINT "CustomerDependent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTag" ADD CONSTRAINT "CustomerTag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSocialProfile" ADD CONSTRAINT "CustomerSocialProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDebt" ADD CONSTRAINT "CustomerDebt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDebt" ADD CONSTRAINT "CustomerDebt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDebtPayment" ADD CONSTRAINT "CustomerDebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "CustomerDebt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerToCustomerTag" ADD CONSTRAINT "_CustomerToCustomerTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerToCustomerTag" ADD CONSTRAINT "_CustomerToCustomerTag_B_fkey" FOREIGN KEY ("B") REFERENCES "CustomerTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

