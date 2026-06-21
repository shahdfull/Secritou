-- Migration: add_proposal_id_to_invoice
-- Links an Invoice back to the Proposal it was generated from.
-- One-to-one: a proposal can only produce one invoice (enforced by @unique).

ALTER TABLE "Invoice"
  ADD COLUMN "proposalId" TEXT UNIQUE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_proposalId_fkey"
  FOREIGN KEY ("proposalId")
  REFERENCES "Proposal"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
