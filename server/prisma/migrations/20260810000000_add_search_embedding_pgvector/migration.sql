-- SEC-070 (RAG sémantique, dégelé le 2026-08-09 — voir REFERENTIEL.md §4.11) : table SearchEmbedding
-- pour les embeddings de recherche sémantique (nomic-embed-text via Ollama, 768 dimensions).
-- Requires the pgvector extension — postgres image switched to pgvector/pgvector:pg16 in the same
-- Phase A (docker-compose.yml/docker-compose.prod.yml), which already ships the extension files.

CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "SearchEmbedding" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    "sourceText" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SearchEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchEmbedding_leadId_key" ON "SearchEmbedding"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchEmbedding_projectId_key" ON "SearchEmbedding"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchEmbedding_taskId_key" ON "SearchEmbedding"("taskId");

-- CreateIndex
CREATE INDEX "SearchEmbedding_leadId_idx" ON "SearchEmbedding"("leadId");

-- CreateIndex
CREATE INDEX "SearchEmbedding_projectId_idx" ON "SearchEmbedding"("projectId");

-- CreateIndex
CREATE INDEX "SearchEmbedding_taskId_idx" ON "SearchEmbedding"("taskId");

-- AddForeignKey
ALTER TABLE "SearchEmbedding" ADD CONSTRAINT "SearchEmbedding_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchEmbedding" ADD CONSTRAINT "SearchEmbedding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchEmbedding" ADD CONSTRAINT "SearchEmbedding_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
