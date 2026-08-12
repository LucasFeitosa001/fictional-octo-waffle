-- AlterTable
ALTER TABLE "UserCompany" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
