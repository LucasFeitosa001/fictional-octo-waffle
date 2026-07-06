-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- DropTable (safe: drop constraint first if exists, then drop table if exists)
ALTER TABLE IF EXISTS "AiAttendantConfig" DROP CONSTRAINT IF EXISTS "AiAttendantConfig_companyId_fkey";
DROP TABLE IF EXISTS "AiAttendantConfig";

-- CreateTable
CREATE TABLE IF NOT EXISTS "WhatsappAuthState" (
    "sessionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsappAuthState_pkey" PRIMARY KEY ("sessionId","category","itemId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WhatsappOutbox" (
    "id" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WhatsappOutbox_status_nextAttemptAt_idx" ON "WhatsappOutbox"("status", "nextAttemptAt");

-- CreateIndex (unique constraint on Review.appointmentId)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Review_appointmentId_key') THEN
    ALTER TABLE "Review" ADD CONSTRAINT "Review_appointmentId_key" UNIQUE ("appointmentId");
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Review_appointmentId_fkey') THEN
    ALTER TABLE "Review" ADD CONSTRAINT "Review_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
