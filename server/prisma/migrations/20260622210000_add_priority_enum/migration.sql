-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable: migrate existing string values to the new enum
ALTER TABLE "ServiceRequest"
  ALTER COLUMN "priority" DROP DEFAULT,
  ALTER COLUMN "priority" TYPE "Priority" USING "priority"::"Priority",
  ALTER COLUMN "priority" SET DEFAULT 'NORMAL';
