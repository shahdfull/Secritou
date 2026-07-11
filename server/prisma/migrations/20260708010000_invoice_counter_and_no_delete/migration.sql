-- Dedicated per-month sequence table for gapless invoice numbering.
-- Replaces count(number startsWith prefix), which is not race-safe and does not
-- guarantee gaplessness once combined with invoice deletion.
CREATE TABLE "InvoiceCounter" (
    "prefix" VARCHAR(20) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("prefix")
);

-- Backfill counters from existing invoice numbers so future numbers continue
-- the sequence instead of restarting at 1.
INSERT INTO "InvoiceCounter" ("prefix", "value")
SELECT
    substring("number" from 1 for 10) AS prefix,
    MAX(CAST(substring("number" from 12 for 4) AS INTEGER)) AS value
FROM "Invoice"
WHERE "number" ~ '^INV-[0-9]{6}-[0-9]{4}$'
GROUP BY substring("number" from 1 for 10)
ON CONFLICT ("prefix") DO NOTHING;
