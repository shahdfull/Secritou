/*
  Warnings:

  - You are about to drop the `ContactRequestArchive` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DocumentArchive` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LeadArchive` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NotificationArchive` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[companyId,number]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[serviceRequestId]` on the table `Proposal` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,email]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "ServiceRequestComment" DROP CONSTRAINT "ServiceRequestComment_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceRequestComment" DROP CONSTRAINT "ServiceRequestComment_serviceRequestId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceRequestHistory" DROP CONSTRAINT "ServiceRequestHistory_serviceRequestId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceRequestHistory" DROP CONSTRAINT "ServiceRequestHistory_userId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_companyId_fkey";

-- DropIndex
DROP INDEX "Client_companyId_createdAt_idx";

-- DropIndex
DROP INDEX "Client_email_trgm_idx";

-- DropIndex
DROP INDEX "Client_name_trgm_idx";

-- DropIndex
DROP INDEX "Comment_taskId_createdAt_idx";

-- DropIndex
DROP INDEX "Company_name_trgm_idx";

-- DropIndex
DROP INDEX "ContactRequest_status_createdAt_idx";

-- DropIndex
DROP INDEX "Document_companyId_createdAt_idx";

-- DropIndex
DROP INDEX "EnhancedDocument_tags_idx";

-- DropIndex
DROP INDEX "FreelancerMission_companyId_createdAt_idx";

-- DropIndex
DROP INDEX "FreelancerMission_companyId_status_updatedAt_idx";

-- DropIndex
DROP INDEX "FreelancerMission_company_status_updated_idx";

-- DropIndex
DROP INDEX "FreelancerProfile_availability_createdAt_idx";

-- DropIndex
DROP INDEX "FreelancerProfile_createdAt_idx";

-- DropIndex
DROP INDEX "FreelancerProfile_hourlyRate_idx";

-- DropIndex
DROP INDEX "Lead_companyId_createdAt_idx";

-- DropIndex
DROP INDEX "Lead_companyId_status_createdAt_idx";

-- DropIndex
DROP INDEX "Lead_email_trgm_idx";

-- DropIndex
DROP INDEX "Lead_name_trgm_idx";

-- DropIndex
DROP INDEX "Lead_notes_trgm_idx";

-- DropIndex
DROP INDEX "Lead_source_trgm_idx";

-- DropIndex
DROP INDEX "MissionApplication_missionId_createdAt_idx";

-- DropIndex
DROP INDEX "Notification_userId_createdAt_idx";

-- DropIndex
DROP INDEX "PortfolioItem_freelancerId_createdAt_idx";

-- DropIndex
DROP INDEX "Project_companyId_createdAt_idx";

-- DropIndex
DROP INDEX "Project_description_trgm_idx";

-- DropIndex
DROP INDEX "Project_name_trgm_idx";

-- DropIndex
DROP INDEX "ServiceRequest_companyId_createdAt_idx";

-- DropIndex
DROP INDEX "Task_description_trgm_idx";

-- DropIndex
DROP INDEX "Task_projectId_createdAt_idx";

-- DropIndex
DROP INDEX "Task_title_trgm_idx";

-- DropIndex
DROP INDEX "User_companyId_createdAt_idx";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "Approval" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ClientOnboarding" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ClientSuccess" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Contract" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Delivery" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EnhancedDocument" ALTER COLUMN "tags" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FreelancerApplication" ALTER COLUMN "accountCreatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KickoffMeeting" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OnboardingStep" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductionProgress" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "serviceRequestId" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProposalSection" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Questionnaire" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ServiceRequestComment" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ServiceRequestHistory" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Specifications" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SuccessMetric" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SuccessObjective" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SuccessRecommendation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "ContactRequestArchive";

-- DropTable
DROP TABLE "DocumentArchive";

-- DropTable
DROP TABLE "LeadArchive";

-- DropTable
DROP TABLE "NotificationArchive";

-- CreateIndex
CREATE INDEX "Client_companyId_createdAt_idx" ON "Client"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactRequest_status_createdAt_idx" ON "ContactRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Document_companyId_createdAt_idx" ON "Document"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "EnhancedDocument_tags_idx" ON "EnhancedDocument"("tags");

-- CreateIndex
CREATE INDEX "FreelancerMission_companyId_status_updatedAt_idx" ON "FreelancerMission"("companyId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "FreelancerMission_companyId_createdAt_idx" ON "FreelancerMission"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "FreelancerProfile_userId_createdAt_idx" ON "FreelancerProfile"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_companyId_status_createdAt_idx" ON "Invoice"("companyId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_number_key" ON "Invoice"("companyId", "number");

-- CreateIndex
CREATE INDEX "Lead_companyId_createdAt_idx" ON "Lead"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_companyId_status_createdAt_idx" ON "Lead"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MissionApplication_missionId_createdAt_idx" ON "MissionApplication"("missionId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Project_companyId_status_updatedAt_idx" ON "Project"("companyId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Project_companyId_createdAt_idx" ON "Project"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_serviceRequestId_key" ON "Proposal"("serviceRequestId");

-- CreateIndex
CREATE INDEX "Proposal_serviceRequestId_idx" ON "Proposal"("serviceRequestId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "ServiceRequest_companyId_createdAt_idx" ON "ServiceRequest"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_companyId_status_createdAt_idx" ON "ServiceRequest"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Task_projectId_createdAt_idx" ON "Task"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_dueDate_status_idx" ON "Task"("dueDate", "status");

-- CreateIndex
CREATE INDEX "User_companyId_createdAt_idx" ON "User"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequestComment" ADD CONSTRAINT "ServiceRequestComment_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequestComment" ADD CONSTRAINT "ServiceRequestComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequestHistory" ADD CONSTRAINT "ServiceRequestHistory_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequestHistory" ADD CONSTRAINT "ServiceRequestHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
