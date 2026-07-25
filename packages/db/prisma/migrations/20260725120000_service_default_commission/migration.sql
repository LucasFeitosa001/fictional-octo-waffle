-- Preserve the Belasis catalog-level commission percentage for services.
-- ProfessionalCommissionRule remains the per-professional override.
ALTER TABLE "Service"
ADD COLUMN "defaultCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
