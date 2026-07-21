-- Enforce one active lead per email so concurrent manager creations cannot silently duplicate the pipeline.
-- Archived leads are excluded so an old lost/won lead can still be re-entered later if needed.
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_email_active_key"
ON "Lead" (LOWER(email))
WHERE email IS NOT NULL AND "archivedAt" IS NULL;
