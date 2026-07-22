-- Wave 2/3 backend: campos ADITIVOS (todos nullable ou com default) — sem breaking.
-- Brand.active já existia (migração anterior), portanto não é alterado aqui.

-- Product: controle de estoque, cashback configurável e motivo de saída.
ALTER TABLE "Product" ADD COLUMN     "trackStock" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN     "cashbackActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN     "cashbackType" TEXT;
ALTER TABLE "Product" ADD COLUMN     "cashbackValue" DECIMAL(12,2);
ALTER TABLE "Product" ADD COLUMN     "exitReason" TEXT;

-- PaymentMethod: taxa fixa, ativo/inativo, tipo e favorito.
ALTER TABLE "PaymentMethod" ADD COLUMN     "feeFixed" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "PaymentMethod" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PaymentMethod" ADD COLUMN     "kind" TEXT;
ALTER TABLE "PaymentMethod" ADD COLUMN     "favorite" BOOLEAN NOT NULL DEFAULT false;

-- FinancialAccount: conta somente para administradores.
ALTER TABLE "FinancialAccount" ADD COLUMN     "adminOnly" BOOLEAN NOT NULL DEFAULT false;

-- Customer: endereço embutido + observações livres (observations, pois `notes`
-- já é a relação CustomerNote[]).
ALTER TABLE "Customer" ADD COLUMN     "cep" TEXT;
ALTER TABLE "Customer" ADD COLUMN     "street" TEXT;
ALTER TABLE "Customer" ADD COLUMN     "number" TEXT;
ALTER TABLE "Customer" ADD COLUMN     "district" TEXT;
ALTER TABLE "Customer" ADD COLUMN     "city" TEXT;
ALTER TABLE "Customer" ADD COLUMN     "state" TEXT;
ALTER TABLE "Customer" ADD COLUMN     "complement" TEXT;
ALTER TABLE "Customer" ADD COLUMN     "observations" TEXT;

-- Service: tipo de preço e tipo de custo adicional.
ALTER TABLE "Service" ADD COLUMN     "priceType" TEXT;
ALTER TABLE "Service" ADD COLUMN     "additionalCostType" TEXT;

-- Purchase: número da nota fiscal + outras despesas/receitas.
ALTER TABLE "Purchase" ADD COLUMN     "invoiceNumber" TEXT;
ALTER TABLE "Purchase" ADD COLUMN     "otherExpenses" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Purchase" ADD COLUMN     "otherIncome" DECIMAL(12,2) NOT NULL DEFAULT 0;
