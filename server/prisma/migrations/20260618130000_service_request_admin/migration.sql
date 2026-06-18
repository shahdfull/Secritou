-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: service_request_admin
-- Adds: new statuses, priority, assignedToId, comments, history
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend ServiceRequestStatus enum (PostgreSQL ALTER TYPE)
ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'WAITING_CLIENT';
ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- 2. Add new columns to ServiceRequest
ALTER TABLE "ServiceRequest"
  ADD COLUMN IF NOT EXISTS "priority"     VARCHAR(20)  NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;

-- 3. FK: assignedToId → User
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ServiceRequest_assignedToId_fkey'
  ) THEN
    ALTER TABLE "ServiceRequest"
      ADD CONSTRAINT "ServiceRequest_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Create ServiceRequestComment table
CREATE TABLE IF NOT EXISTS "ServiceRequestComment" (
  "id"               TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "body"             TEXT         NOT NULL,
  "isInternal"       BOOLEAN      NOT NULL DEFAULT false,
  "serviceRequestId" TEXT         NOT NULL,
  "authorId"         TEXT         NOT NULL,
  "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "ServiceRequestComment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceRequestComment_serviceRequestId_fkey"
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE,
  CONSTRAINT "ServiceRequestComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ServiceRequestComment_serviceRequestId_idx"
  ON "ServiceRequestComment"("serviceRequestId");
CREATE INDEX IF NOT EXISTS "ServiceRequestComment_serviceRequestId_isInternal_idx"
  ON "ServiceRequestComment"("serviceRequestId", "isInternal");

-- 5. Create ServiceRequestHistory table
CREATE TABLE IF NOT EXISTS "ServiceRequestHistory" (
  "id"               TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "serviceRequestId" TEXT         NOT NULL,
  "userId"           TEXT,
  "field"            VARCHAR(100) NOT NULL,
  "oldValue"         VARCHAR(500),
  "newValue"         VARCHAR(500),
  "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "ServiceRequestHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceRequestHistory_serviceRequestId_fkey"
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE,
  CONSTRAINT "ServiceRequestHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ServiceRequestHistory_serviceRequestId_idx"
  ON "ServiceRequestHistory"("serviceRequestId");
CREATE INDEX IF NOT EXISTS "ServiceRequestHistory_serviceRequestId_createdAt_idx"
  ON "ServiceRequestHistory"("serviceRequestId", "createdAt");

-- 6. Index for assignedToId
CREATE INDEX IF NOT EXISTS "ServiceRequest_assignedToId_idx"
  ON "ServiceRequest"("assignedToId");
