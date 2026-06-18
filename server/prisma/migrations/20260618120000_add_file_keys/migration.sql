-- Migration: add_file_keys
-- Adds S3 object key columns alongside existing URL columns.
-- URL columns are kept for backward compatibility during rollout.

-- FreelancerApplication: cv and portfolio S3 keys
ALTER TABLE "FreelancerApplication"
  ADD COLUMN IF NOT EXISTS "cvKey"        VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "portfolioKey" VARCHAR(500);

-- Document: generic S3 key
ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "fileKey" VARCHAR(500);

-- EnhancedDocument: S3 key
ALTER TABLE "EnhancedDocument"
  ADD COLUMN IF NOT EXISTS "fileKey" VARCHAR(500);
