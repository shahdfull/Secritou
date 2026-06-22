/*
  Warnings:

  - The values [INVOICE,OTHER] on the enum `DocumentType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `EnhancedDocument` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[proposalId]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `title` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadedById` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DocumentType_new" AS ENUM ('WELCOME_LETTER', 'CONTRACT', 'SPECS', 'CLIENT_BRIEF', 'QUOTE', 'INVOICE_DEPOSIT', 'INVOICE_BALANCE', 'ROADMAP');
ALTER TABLE "public"."Document" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Document" ALTER COLUMN "type" TYPE "DocumentType_new" USING ("type"::text::"DocumentType_new");
ALTER TYPE "DocumentType" RENAME TO "DocumentType_old";
ALTER TYPE "DocumentType_new" RENAME TO "DocumentType";
DROP TYPE "public"."DocumentType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "DocumentAccessLog" DROP CONSTRAINT "DocumentAccessLog_documentId_fkey";

-- DropForeignKey
ALTER TABLE "EnhancedDocument" DROP CONSTRAINT "EnhancedDocument_clientId_fkey";

-- DropForeignKey
ALTER TABLE "EnhancedDocument" DROP CONSTRAINT "EnhancedDocument_companyId_fkey";

-- DropForeignKey
ALTER TABLE "EnhancedDocument" DROP CONSTRAINT "EnhancedDocument_parentId_fkey";

-- DropForeignKey
ALTER TABLE "EnhancedDocument" DROP CONSTRAINT "EnhancedDocument_projectId_fkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "accessLevel" "DocumentAccessLevel" NOT NULL DEFAULT 'CLIENT_ADMIN',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "enhancedType" "EnhancedDocumentType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "fileUrl" VARCHAR(500),
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "signedAt" TIMESTAMPTZ(6),
ADD COLUMN     "signedByClientId" TEXT,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "title" VARCHAR(255) NOT NULL,
ADD COLUMN     "uploadedById" TEXT NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "type" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "proposalId" TEXT;

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "leadId" TEXT;

-- DropTable
DROP TABLE "EnhancedDocument";

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "Document_enhancedType_idx" ON "Document"("enhancedType");

-- CreateIndex
CREATE INDEX "Document_tags_idx" ON "Document"("tags");

-- CreateIndex
CREATE INDEX "Document_companyId_type_idx" ON "Document"("companyId", "type");

-- CreateIndex
CREATE INDEX "Document_companyId_enhancedType_idx" ON "Document"("companyId", "enhancedType");

-- CreateIndex
CREATE UNIQUE INDEX "Project_proposalId_key" ON "Project"("proposalId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_signedByClientId_fkey" FOREIGN KEY ("signedByClientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
