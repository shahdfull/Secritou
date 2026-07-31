-- AlterTable: findAll (aiConversation.repository.ts) sorts by updatedAt desc, filtered by userId,
-- but the only composite index covered [userId, createdAt] — a column never sorted on for this
-- model. Replace it with the index that matches the real query (SEC-057).
DROP INDEX "AiConversation_userId_createdAt_idx";

CREATE INDEX "AiConversation_userId_updatedAt_idx" ON "AiConversation"("userId", "updatedAt");
