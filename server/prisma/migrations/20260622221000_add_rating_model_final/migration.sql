-- Rebuild Rating table with the final schema: score Int, ratedByUserId (nullable), companyId.
-- The previous migration (20260622202000) created the table with reviewerId+score Decimal.
-- This migration drops the old table and recreates it with the correct structure.

DROP TABLE IF EXISTS "Rating";

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "freelancerId" TEXT NOT NULL,
    "ratedByUserId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rating_freelancerId_idx" ON "Rating"("freelancerId");
CREATE INDEX "Rating_companyId_idx" ON "Rating"("companyId");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_ratedByUserId_fkey" FOREIGN KEY ("ratedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
