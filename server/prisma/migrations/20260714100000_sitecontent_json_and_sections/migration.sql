-- Extends SiteContent to cover the remaining landing page sections
-- (Problems, HowItWorks, Differentiators, BusinessImpact, FAQ, Solutions,
-- CaseStudies, FinalCTA, SocialProof) and adds two content types: JSON
-- (a whole variable-length list stored as one row, so the admin edits/adds/
-- removes items as a unit) and SELECT (a value constrained to a fixed set of
-- choices, e.g. a section's background token — the allowed options live in
-- the client-side select field, not the database).
ALTER TYPE "SiteContentSection" ADD VALUE 'PROBLEMS';
ALTER TYPE "SiteContentSection" ADD VALUE 'HOW_IT_WORKS';
ALTER TYPE "SiteContentSection" ADD VALUE 'DIFFERENTIATORS';
ALTER TYPE "SiteContentSection" ADD VALUE 'BUSINESS_IMPACT';
ALTER TYPE "SiteContentSection" ADD VALUE 'FAQ';
ALTER TYPE "SiteContentSection" ADD VALUE 'SOLUTIONS';
ALTER TYPE "SiteContentSection" ADD VALUE 'CASE_STUDIES';
ALTER TYPE "SiteContentSection" ADD VALUE 'FINAL_CTA';
ALTER TYPE "SiteContentSection" ADD VALUE 'SOCIAL_PROOF';

ALTER TYPE "SiteContentType" ADD VALUE 'JSON';
ALTER TYPE "SiteContentType" ADD VALUE 'SELECT';

-- NOTE: "Invoice_projectId_invoiceType_key" and "Proposal_leadId_key" were
-- intentionally omitted — see migration 20260714080000's note (now removed,
-- but the reasoning still applies): they already exist as partial unique
-- indexes; Prisma's diff tool can't express the WHERE clause and would
-- otherwise recreate them as full duplicates.
