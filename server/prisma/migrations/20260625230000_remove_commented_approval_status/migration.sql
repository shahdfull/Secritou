-- Recreates the ApprovalStatus enum without COMMENTED. Both Approval.status and
-- ApprovalTimeline.status use this enum, so COMMENTED rows are remapped to PENDING and both
-- columns are converted here before the old enum type is dropped.
--
-- NOTE: this migration originally assumed ApprovalTimeline.status had already been converted
-- to VARCHAR(50) via a manual out-of-band DB operation on one dev database. That assumption
-- does not hold when replaying migrations from scratch (fresh DB, CI, production) — the
-- original script failed with "cannot drop type ApprovalStatus_old because other objects
-- depend on it" (ApprovalTimeline.status). Fixed here to be self-contained.

ALTER TABLE "Approval" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "ApprovalStatus" RENAME TO "ApprovalStatus_old";
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "Approval" ALTER COLUMN "status" TYPE "ApprovalStatus" USING "status"::text::"ApprovalStatus";
ALTER TABLE "Approval" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ApprovalStatus";
UPDATE "ApprovalTimeline" SET "status" = 'PENDING' WHERE "status"::text = 'COMMENTED';
ALTER TABLE "ApprovalTimeline" ALTER COLUMN "status" TYPE "ApprovalStatus" USING "status"::text::"ApprovalStatus";
ALTER TABLE "ApprovalTimeline" ALTER COLUMN "status" TYPE VARCHAR(50);
DROP TYPE "ApprovalStatus_old";
