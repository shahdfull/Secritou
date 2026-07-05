-- Add new NotificationType enum values
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PROJECT_STALE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_STALE';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PROJECT_DEADLINE_SOON' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_DEADLINE_SOON';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'INVOICE_FOLLOWUP' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'INVOICE_FOLLOWUP';
  END IF;
END $$;

-- Create TimeEntry table
CREATE TABLE IF NOT EXISTS "TimeEntry" (
  "id"          TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "taskId"      TEXT,
  "description" VARCHAR(500),
  "minutes"     INTEGER NOT NULL,
  "date"        DATE NOT NULL,
  "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimeEntry_projectId_fkey') THEN
    ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimeEntry_userId_fkey') THEN
    ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimeEntry_taskId_fkey') THEN
    ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "TimeEntry_projectId_idx" ON "TimeEntry"("projectId");
CREATE INDEX IF NOT EXISTS "TimeEntry_userId_idx" ON "TimeEntry"("userId");
CREATE INDEX IF NOT EXISTS "TimeEntry_date_idx" ON "TimeEntry"("date");
