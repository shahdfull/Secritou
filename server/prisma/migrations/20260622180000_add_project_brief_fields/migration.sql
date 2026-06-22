ALTER TABLE "Project"
  ADD COLUMN "serviceType"      VARCHAR(50),
  ADD COLUMN "briefData"        JSONB,
  ADD COLUMN "briefCompleted"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "briefCompletedAt" TIMESTAMPTZ(6);
