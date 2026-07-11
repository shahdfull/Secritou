-- Add Tunisian tax identifier and address to Company, needed on invoice PDFs for
-- legal opposability (matricule fiscal). Nullable: existing single row is backfilled
-- manually via admin settings, not by this migration.
ALTER TABLE "Company" ADD COLUMN "matriculeFiscal" VARCHAR(50);
ALTER TABLE "Company" ADD COLUMN "address" VARCHAR(500);
