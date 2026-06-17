-- CreateEnum
CREATE TYPE "MissionApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterEnum
ALTER TYPE "MissionStatus" ADD VALUE 'ASSIGNED';

-- AlterTable
ALTER TABLE "FreelancerProfile" ADD COLUMN     "rating" DECIMAL(2,1),
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MissionApplication" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "status" "MissionApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MissionApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "url" VARCHAR(255),
    "imageUrl" VARCHAR(255),
    "freelancerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissionApplication_missionId_idx" ON "MissionApplication"("missionId");

-- CreateIndex
CREATE INDEX "MissionApplication_freelancerId_idx" ON "MissionApplication"("freelancerId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionApplication_missionId_freelancerId_key" ON "MissionApplication"("missionId", "freelancerId");

-- CreateIndex
CREATE INDEX "PortfolioItem_freelancerId_idx" ON "PortfolioItem"("freelancerId");

-- AddForeignKey
ALTER TABLE "MissionApplication" ADD CONSTRAINT "MissionApplication_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "FreelancerMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionApplication" ADD CONSTRAINT "MissionApplication_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
