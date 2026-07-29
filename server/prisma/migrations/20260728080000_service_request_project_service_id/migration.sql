-- SEC-004 (4.6 Portail client) : ServiceRequest gagne un lien direct vers Project et Service,
-- pour permettre un scope exact par pôle au niveau service au lieu de l'approximation
-- client.projects.some.serviceId (qui expose toute demande d'un client multi-pôle à chaque
-- pôle où il a un projet). Champs déjà présents dans schema.prisma depuis une session
-- antérieure, sans migration correspondante jusqu'ici.

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "serviceId" TEXT;

-- CreateIndex
CREATE INDEX "ServiceRequest_projectId_idx" ON "ServiceRequest"("projectId");

-- CreateIndex
CREATE INDEX "ServiceRequest_serviceId_idx" ON "ServiceRequest"("serviceId");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
