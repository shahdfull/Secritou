-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "invoiceId" TEXT;
ALTER TABLE "Payment" ADD COLUMN     "method" TEXT;
ALTER TABLE "Payment" ADD COLUMN     "recordedById" TEXT;
ALTER TABLE "Payment" ADD COLUMN     "reference" TEXT;

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "Payment_recordedById_idx" ON "Payment"("recordedById");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Copy invoice payment history into the unified payment table.
INSERT INTO "Payment" (
  "id",
  "invoiceId",
  "amount",
  "method",
  "reference",
  "recordedById",
  "paidAt",
  "createdAt",
  "updatedAt"
)
SELECT
  ip."id",
  ip."invoiceId",
  ip."amount",
  ip."method",
  ip."reference",
  ip."recordedById",
  ip."paidAt",
  ip."createdAt",
  ip."createdAt"
FROM "InvoicePayment" ip
ON CONFLICT ("id") DO NOTHING;

-- DropTable
DROP TABLE "InvoicePayment";

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "onboardingStepId" DROP NOT NULL;

