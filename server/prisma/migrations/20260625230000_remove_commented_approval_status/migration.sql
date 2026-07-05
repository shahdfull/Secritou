-- ApprovalTimeline.status was already converted to VARCHAR(50) and COMMENTED rows
-- were remapped to PENDING via a direct DB operation before this migration ran.
-- This migration only handles recreating the ApprovalStatus enum without COMMENTED.

ALTER TABLE "Approval" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "ApprovalStatus" RENAME TO "ApprovalStatus_old";
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "Approval" ALTER COLUMN "status" TYPE "ApprovalStatus" USING "status"::text::"ApprovalStatus";
ALTER TABLE "Approval" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ApprovalStatus";
DROP TYPE "ApprovalStatus_old";
