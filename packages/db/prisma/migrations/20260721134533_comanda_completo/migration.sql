-- Comanda completo: Auxiliares, Produtos consumidos, Lotes de produto + batchId no item.
-- Crédito/Cashback já existem em Order (creditUsed/cashbackUsed) e nos ledgers
-- CustomerCredit/CustomerCashback — nenhuma coluna nova para saldo (derivado por soma).

-- CreateEnum
CREATE TYPE "AuxiliaryDiscountFrom" AS ENUM ('establishment', 'professional');

-- AlterTable: item de PRODUTO ganha aba "Lote"
ALTER TABLE "OrderItem" ADD COLUMN "batchId" TEXT;

-- CreateTable: Lote de produto (company-scoped)
CREATE TABLE "ProductBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "manufacturedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable: aba "Auxiliares" do item de serviço (rateio de comissão)
CREATE TABLE "OrderItemAuxiliary" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "discountFrom" "AuxiliaryDiscountFrom" NOT NULL,
    "valueType" "DiscountType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemAuxiliary_pkey" PRIMARY KEY ("id")
);

-- CreateTable: aba "Produtos consumidos" do item de serviço (baixa de estoque, fora do total)
CREATE TABLE "OrderItemConsumedProduct" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "extraQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemConsumedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderItem_batchId_idx" ON "OrderItem"("batchId");
CREATE INDEX "ProductBatch_companyId_idx" ON "ProductBatch"("companyId");
CREATE INDEX "ProductBatch_productId_idx" ON "ProductBatch"("productId");
CREATE INDEX "OrderItemAuxiliary_orderItemId_idx" ON "OrderItemAuxiliary"("orderItemId");
CREATE INDEX "OrderItemAuxiliary_professionalId_idx" ON "OrderItemAuxiliary"("professionalId");
CREATE INDEX "OrderItemConsumedProduct_orderItemId_idx" ON "OrderItemConsumedProduct"("orderItemId");
CREATE INDEX "OrderItemConsumedProduct_productId_idx" ON "OrderItemConsumedProduct"("productId");
CREATE INDEX "OrderItemConsumedProduct_batchId_idx" ON "OrderItemConsumedProduct"("batchId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderItemAuxiliary" ADD CONSTRAINT "OrderItemAuxiliary_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemAuxiliary" ADD CONSTRAINT "OrderItemAuxiliary_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItemConsumedProduct" ADD CONSTRAINT "OrderItemConsumedProduct_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemConsumedProduct" ADD CONSTRAINT "OrderItemConsumedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItemConsumedProduct" ADD CONSTRAINT "OrderItemConsumedProduct_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
