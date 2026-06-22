-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "clientName" VARCHAR(255),
ADD COLUMN     "email" VARCHAR(255);

-- CreateIndex
CREATE INDEX "Proposal_leadId_idx" ON "Proposal"("leadId");
