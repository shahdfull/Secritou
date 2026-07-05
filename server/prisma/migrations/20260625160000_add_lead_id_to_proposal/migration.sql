-- Add leadId to Proposal: one-to-one optional relation with Lead
ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Proposal_leadId_key" ON "Proposal"("leadId") WHERE "leadId" IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Proposal_leadId_fkey') THEN
    ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
