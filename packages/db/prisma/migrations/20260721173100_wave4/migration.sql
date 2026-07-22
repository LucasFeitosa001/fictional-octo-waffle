-- Wave 4: itens do plano de assinatura com preço/desconto/quantidade por item
-- + arquivos/imagens anexados ao cadastro do cliente. Mudanças aditivas (colunas
-- nullable, tabela nova) — sem breaking.

-- 1) ASSINATURAS — grid de itens editável: preço, desconto e quantidade por item.
ALTER TABLE "MembershipService" ADD COLUMN     "discount" DECIMAL(12,2),
ADD COLUMN     "quantity" DECIMAL(65,30) DEFAULT 1,
ADD COLUMN     "unitPrice" DECIMAL(12,2);

-- 2) CLIENTE — arquivos/imagens (url vem de /uploads).
-- CreateTable
CREATE TABLE "CustomerFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerFile_companyId_idx" ON "CustomerFile"("companyId");

-- CreateIndex
CREATE INDEX "CustomerFile_customerId_idx" ON "CustomerFile"("customerId");

-- AddForeignKey
ALTER TABLE "CustomerFile" ADD CONSTRAINT "CustomerFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFile" ADD CONSTRAINT "CustomerFile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
