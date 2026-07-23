-- AlterTable
ALTER TABLE "ProfessionalInvite" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "professionalId" TEXT;

-- CreateIndex
CREATE INDEX "ProfessionalInvite_professionalId_idx" ON "ProfessionalInvite"("professionalId");

-- AddForeignKey
ALTER TABLE "ProfessionalInvite" ADD CONSTRAINT "ProfessionalInvite_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
