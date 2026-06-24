-- Fix SuccessRecommendation: replace Int priority and String status with proper enums.
-- Fix SuccessMetric: the validator now sends initialValue/currentValue (already correct in DB).

-- Create enums
CREATE TYPE "RecommendationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- Migrate priority: 0→MEDIUM, 1→LOW, 2→MEDIUM, 3→HIGH (legacy int mapping)
ALTER TABLE "SuccessRecommendation"
  ADD COLUMN "priority_new" "RecommendationPriority" NOT NULL DEFAULT 'MEDIUM';

UPDATE "SuccessRecommendation"
  SET "priority_new" = CASE
    WHEN "priority" <= 1 THEN 'LOW'::"RecommendationPriority"
    WHEN "priority" = 2  THEN 'MEDIUM'::"RecommendationPriority"
    ELSE                      'HIGH'::"RecommendationPriority"
  END;

ALTER TABLE "SuccessRecommendation" DROP COLUMN "priority";
ALTER TABLE "SuccessRecommendation" RENAME COLUMN "priority_new" TO "priority";

-- Migrate status: coerce any existing value to the enum (DONE/COMPLETED → DONE, else PENDING)
ALTER TABLE "SuccessRecommendation"
  ADD COLUMN "status_new" "RecommendationStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "SuccessRecommendation"
  SET "status_new" = CASE
    WHEN "status" IN ('DONE', 'COMPLETED') THEN 'DONE'::"RecommendationStatus"
    WHEN "status" = 'IN_PROGRESS'          THEN 'IN_PROGRESS'::"RecommendationStatus"
    ELSE                                        'PENDING'::"RecommendationStatus"
  END;

ALTER TABLE "SuccessRecommendation" DROP COLUMN "status";
ALTER TABLE "SuccessRecommendation" RENAME COLUMN "status_new" TO "status";

-- Recreate index (priority is now an enum, not an int)
DROP INDEX IF EXISTS "SuccessRecommendation_successId_priority_idx";
CREATE INDEX "SuccessRecommendation_successId_idx" ON "SuccessRecommendation"("successId");
