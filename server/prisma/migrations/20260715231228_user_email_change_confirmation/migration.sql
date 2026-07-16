-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailChangeTokenExpiry" TIMESTAMPTZ(6),
ADD COLUMN     "emailChangeTokenHash" VARCHAR(255),
ADD COLUMN     "pendingEmail" VARCHAR(255);

-- CreateIndex
CREATE INDEX "User_emailChangeTokenHash_idx" ON "User"("emailChangeTokenHash");
