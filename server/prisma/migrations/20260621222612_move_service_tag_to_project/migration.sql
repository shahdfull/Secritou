-- Forward correction: a Client must not be tagged with a single service (it may buy from
-- several poles). Drop Client.serviceId and move the service tag onto Project (the delivery
-- unit). A manager's visibility on a client is derived from the client's projects.

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT IF EXISTS "Client_serviceId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Client_serviceId_idx";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN IF EXISTS "serviceId";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "serviceId" TEXT;

-- CreateIndex
CREATE INDEX "Project_serviceId_idx" ON "Project"("serviceId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
