-- CreateEnum
CREATE TYPE "ServiceRequestType" AS ENUM ('SUPPORT', 'NEW_PROJECT');

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN "type" "ServiceRequestType" NOT NULL DEFAULT 'NEW_PROJECT';

