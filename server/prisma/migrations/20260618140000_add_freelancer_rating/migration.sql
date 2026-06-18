-- CreateTable
CREATE TABLE "FreelancerRating" (
    "id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "freelancerId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FreelancerRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FreelancerRating_applicationId_key" ON "FreelancerRating"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "FreelancerRating_missionId_freelancerId_key" ON "FreelancerRating"("missionId", "freelancerId");

-- CreateIndex
CREATE INDEX "FreelancerRating_freelancerId_idx" ON "FreelancerRating"("freelancerId");

-- CreateIndex
CREATE INDEX "FreelancerRating_reviewerId_idx" ON "FreelancerRating"("reviewerId");

-- CreateIndex
CREATE INDEX "FreelancerRating_freelancerId_score_idx" ON "FreelancerRating"("freelancerId", "score");

-- AddForeignKey
ALTER TABLE "FreelancerRating" ADD CONSTRAINT "FreelancerRating_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelancerRating" ADD CONSTRAINT "FreelancerRating_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "FreelancerMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelancerRating" ADD CONSTRAINT "FreelancerRating_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MissionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelancerRating" ADD CONSTRAINT "FreelancerRating_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
