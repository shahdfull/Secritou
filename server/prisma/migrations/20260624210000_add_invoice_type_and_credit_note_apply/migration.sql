ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "invoiceType" "InvoiceType" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "CreditNote" ADD COLUMN IF NOT EXISTS "appliedAt" TIMESTAMPTZ(6);
ALTER TABLE "CreditNote" ADD COLUMN IF NOT EXISTS "appliedToInvoiceId" TEXT;
CREATE INDEX IF NOT EXISTS "Invoice_invoiceType_idx" ON "Invoice"("invoiceType");
CREATE INDEX IF NOT EXISTS "CreditNote_appliedToInvoiceId_idx" ON "CreditNote"("appliedToInvoiceId");
DO  BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditNote_appliedToInvoiceId_fkey') THEN
    ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_appliedToInvoiceId_fkey" FOREIGN KEY ("appliedToInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END ;