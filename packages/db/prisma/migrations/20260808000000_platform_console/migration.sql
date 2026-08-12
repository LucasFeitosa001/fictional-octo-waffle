-- Console de suporte da SalonPass (admin.salonpass.com.br). Ver estudo 135.
--
-- Escrita à mão de propósito. `prisma migrate dev` varreria junto o drift que já
-- existe entre o histórico de migrações e o schema.prisma (a coluna
-- Appointment.remindClient nunca ganhou migração, a FK de Service.categoryId
-- aponta para ServiceCategory no banco e para ProductCategory no schema, e o
-- índice WhatsappOutbox_whatsappMessageId_idx sumiu). Empacotar aquilo dentro
-- desta mudança seria despejar em produção alterações que ninguém revisou.

-- CreateEnum
CREATE TYPE "PlatformStaffRole" AS ENUM ('support', 'engineer', 'owner');

-- CreateTable
CREATE TABLE "PlatformStaff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "PlatformStaffRole" NOT NULL DEFAULT 'support',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "PlatformStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSession" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "staffId" TEXT,
    "staffEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "companyId" TEXT,
    "reason" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformStaff_email_key" ON "PlatformStaff"("email");
CREATE INDEX "PlatformStaff_email_idx" ON "PlatformStaff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSession_tokenHash_key" ON "PlatformSession"("tokenHash");
CREATE INDEX "PlatformSession_staffId_idx" ON "PlatformSession"("staffId");
CREATE INDEX "PlatformSession_expiresAt_idx" ON "PlatformSession"("expiresAt");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_at_idx" ON "PlatformAuditLog"("at");
CREATE INDEX "PlatformAuditLog_staffId_idx" ON "PlatformAuditLog"("staffId");
CREATE INDEX "PlatformAuditLog_targetType_targetId_idx" ON "PlatformAuditLog"("targetType", "targetId");
CREATE INDEX "PlatformAuditLog_companyId_idx" ON "PlatformAuditLog"("companyId");
CREATE INDEX "PlatformAuditLog_action_idx" ON "PlatformAuditLog"("action");

-- AddForeignKey
ALTER TABLE "PlatformStaff" ADD CONSTRAINT "PlatformStaff_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "PlatformStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "PlatformStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "PlatformStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: marca a sessão de salão nascida de um "entrar como" do console.
-- Nullable e sem FK: o valor sobrevive à exclusão do técnico, e a trilha de
-- auditoria continua apontando para quem entrou.
ALTER TABLE "Session" ADD COLUMN "impersonatedByStaffId" TEXT;

-- CreateIndex
CREATE INDEX "Session_impersonatedByStaffId_idx" ON "Session"("impersonatedByStaffId");
