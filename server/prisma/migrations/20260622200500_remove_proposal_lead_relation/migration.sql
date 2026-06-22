-- DropIndex
DROP INDEX IF EXISTS "Proposal_leadId_idx";

-- AlterTable
ALTER TABLE "Proposal" DROP COLUMN IF EXISTS "leadId";

