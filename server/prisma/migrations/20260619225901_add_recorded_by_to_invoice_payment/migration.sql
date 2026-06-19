-- AlterTable
ALTER TABLE "InvoicePayment" ADD COLUMN     "recordedById" TEXT;

-- CreateIndex
CREATE INDEX "InvoicePayment_recordedById_idx" ON "InvoicePayment"("recordedById");

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
