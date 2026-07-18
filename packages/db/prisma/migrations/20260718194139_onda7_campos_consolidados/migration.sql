-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "city" TEXT,
ADD COLUMN     "complement" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "document" TEXT,
ADD COLUMN     "generateSchedule" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "receivesCommission" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rg" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "zip" TEXT;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "freight" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "number" INTEGER,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'lancada';

-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN     "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ImportedXml" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accessKey" TEXT,
    "fileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "purchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedXml_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalonWebProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "wifi" BOOLEAN NOT NULL DEFAULT false,
    "snackBar" BOOLEAN NOT NULL DEFAULT false,
    "parkingLot" BOOLEAN NOT NULL DEFAULT false,
    "kids" BOOLEAN NOT NULL DEFAULT false,
    "accessibility" BOOLEAN NOT NULL DEFAULT false,
    "themePreference" TEXT,
    "schedulingFlow" TEXT,
    "requiredLogin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalonWebProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryPhoto" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportedXml_companyId_idx" ON "ImportedXml"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SalonWebProfile_companyId_key" ON "SalonWebProfile"("companyId");

-- CreateIndex
CREATE INDEX "GalleryPhoto_companyId_idx" ON "GalleryPhoto"("companyId");

-- CreateIndex
CREATE INDEX "Purchase_companyId_number_idx" ON "Purchase"("companyId", "number");

-- AddForeignKey
ALTER TABLE "ImportedXml" ADD CONSTRAINT "ImportedXml_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonWebProfile" ADD CONSTRAINT "SalonWebProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryPhoto" ADD CONSTRAINT "GalleryPhoto_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

