-- RG-011 (refonte paiement à la tâche, LOT 5) : fee fixe du Manager de pôle, exigible à la
-- livraison du projet. User.canExecuteAsFreelancer (défaut false) permet à un Manager d'être
-- assigneeId d'une Task en plus de superviser son pôle. Aucune donnée existante modifiée.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canExecuteAsFreelancer" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProjectManagerFee" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProjectManagerFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectManagerFee_projectId_idx" ON "ProjectManagerFee"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectManagerFee_projectId_managerId_key" ON "ProjectManagerFee"("projectId", "managerId");

-- AddForeignKey
ALTER TABLE "ProjectManagerFee" ADD CONSTRAINT "ProjectManagerFee_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectManagerFee" ADD CONSTRAINT "ProjectManagerFee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
