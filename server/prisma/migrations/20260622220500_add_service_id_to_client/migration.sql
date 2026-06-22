-- AlterTable: add serviceId to Client
ALTER TABLE "Client" ADD COLUMN "serviceId" TEXT;

-- CreateIndex
CREATE INDEX "Client_serviceId_idx" ON "Client"("serviceId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
