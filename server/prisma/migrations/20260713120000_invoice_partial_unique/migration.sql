-- Replace the full unique index on ("projectId", "invoiceType") with a PARTIAL one.
--
-- The original constraint (added in 20260711183136_sync_schema_drift) was meant to guarantee that
-- a project has at most one DEPOSIT and one BALANCE invoice — the proposal acceptance cascade
-- relies on the resulting P2002 to stay idempotent when two acceptances race.
--
-- But "invoiceType" defaults to STANDARD, so the constraint also capped STANDARD invoices at ONE
-- per project: any second standard invoice on a project (retainer, progress billing, amendment)
-- failed with a P2002 surfaced to the user as an unexplained 409. That was a silent functional
-- blocker, not a safety property.
--
-- Excluding STANDARD from the index keeps the DEPOSIT/BALANCE guarantee (and the P2002 the cascade
-- depends on) while allowing any number of standard invoices per project.
--
-- Partial indexes cannot be expressed in the Prisma schema language, so this index is intentionally
-- declared only here; see the comment on model Invoice in schema.prisma.

DROP INDEX IF EXISTS "Invoice_projectId_invoiceType_key";

CREATE UNIQUE INDEX "Invoice_projectId_invoiceType_key"
  ON "Invoice" ("projectId", "invoiceType")
  WHERE "invoiceType" <> 'STANDARD';
