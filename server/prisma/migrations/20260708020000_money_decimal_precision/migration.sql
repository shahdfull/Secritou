-- TND is denominated in millimes (3 decimal places). Decimal(12,2) rounded every
-- monetary column to 2 decimals, silently losing/gaining millimes across a chain
-- of computations (quote HT -> TVA -> TTC -> deposit/balance splits). Widen all
-- currency-amount columns to Decimal(14,3). KPI/metric value columns (SuccessObjective,
-- SuccessMetric, MetricHistory) are not money and are intentionally left untouched.

ALTER TABLE "Client" ALTER COLUMN "creditBalance" SET DATA TYPE DECIMAL(14,3);

ALTER TABLE "FreelancerProfile" ALTER COLUMN "hourlyRate" SET DATA TYPE DECIMAL(14,3);

ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,3);
ALTER TABLE "Payment" ALTER COLUMN "amountPaid" SET DATA TYPE DECIMAL(14,3);

ALTER TABLE "Proposal" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,3);

ALTER TABLE "Invoice" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,3);
ALTER TABLE "Invoice" ALTER COLUMN "amountHT" SET DATA TYPE DECIMAL(14,3);
ALTER TABLE "Invoice" ALTER COLUMN "tvaAmount" SET DATA TYPE DECIMAL(14,3);
ALTER TABLE "Invoice" ALTER COLUMN "amountPaid" SET DATA TYPE DECIMAL(14,3);

ALTER TABLE "CreditNote" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,3);

ALTER TABLE "InvoiceItem" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,3);
ALTER TABLE "InvoiceItem" ALTER COLUMN "total" SET DATA TYPE DECIMAL(14,3);
