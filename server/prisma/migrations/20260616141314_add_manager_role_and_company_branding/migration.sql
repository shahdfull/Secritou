-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MANAGER';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "logoUrl" VARCHAR(255),
ADD COLUMN     "primaryColor" VARCHAR(20);
