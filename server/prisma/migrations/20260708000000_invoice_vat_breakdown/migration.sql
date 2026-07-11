-- Add VAT breakdown fields to Invoice, populated for invoices generated from a
-- proposal amount (deposit/balance/full conversion). Nullable so invoices built
-- purely from line items (recomputeInvoiceAmount) are unaffected.
ALTER TABLE "Invoice" ADD COLUMN "amountHT" DECIMAL(12,2);
ALTER TABLE "Invoice" ADD COLUMN "tvaRate" DECIMAL(5,4);
ALTER TABLE "Invoice" ADD COLUMN "tvaAmount" DECIMAL(12,2);
