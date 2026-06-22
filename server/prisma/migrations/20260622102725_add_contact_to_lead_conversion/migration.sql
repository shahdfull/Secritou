/*
  Warnings:

  - A unique constraint covering the columns `[sourceContactId]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ContactRequest" ADD COLUMN     "convertedAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "assignedManagerId" TEXT,
ADD COLUMN     "department" VARCHAR(255),
ADD COLUMN     "sourceContactId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_sourceContactId_key" ON "Lead"("sourceContactId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sourceContactId_fkey" FOREIGN KEY ("sourceContactId") REFERENCES "ContactRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedManagerId_fkey" FOREIGN KEY ("assignedManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
