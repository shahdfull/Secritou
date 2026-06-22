-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "projectId" TEXT,
    "score" DECIMAL(2,1) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rating_freelancerId_idx" ON "Rating"("freelancerId");
CREATE INDEX "Rating_reviewerId_idx" ON "Rating"("reviewerId");
CREATE INDEX "Rating_projectId_idx" ON "Rating"("projectId");
CREATE INDEX "Rating_freelancerId_createdAt_idx" ON "Rating"("freelancerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

