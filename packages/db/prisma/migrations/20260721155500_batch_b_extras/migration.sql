-- Batch B extras: Anamnese (modelos), Metas por profissional, Cashback programa global.
-- Todas as mudanças são ADITIVAS (colunas nullable ou com default, tabela nova) — sem breaking.

-- 3) CASHBACK — configuração global do programa (na Company)
ALTER TABLE "Company" ADD COLUMN     "cashbackActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cashbackCanRedeem" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cashbackMinimum" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cashbackValue" DECIMAL(12,2),
ADD COLUMN     "cashbackValueType" TEXT;

-- 2) METAS — escopo por profissional
ALTER TABLE "Goal" ADD COLUMN     "employeeId" TEXT;

-- 1) ANAMNESE — modelos de ficha reutilizáveis
CREATE TABLE "AnamnesisTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "questionsJson" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnamnesisTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnamnesisTemplate_companyId_idx" ON "AnamnesisTemplate"("companyId");

-- CreateIndex
CREATE INDEX "Goal_employeeId_idx" ON "Goal"("employeeId");

-- AddForeignKey
ALTER TABLE "AnamnesisTemplate" ADD CONSTRAINT "AnamnesisTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
