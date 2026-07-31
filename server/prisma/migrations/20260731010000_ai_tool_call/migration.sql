-- CreateTable: AiToolCall — audit/debug trace of what the AI assistant read from the CRM via
-- tool calling, on behalf of which conversation (follow-up to SEC-059). Separate from AiMessage
-- by design: tool exchanges are never persisted as chat history.
CREATE TABLE "AiToolCall" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tool" VARCHAR(100) NOT NULL,
    "args" TEXT NOT NULL,
    "outcome" VARCHAR(20) NOT NULL,
    "rowCount" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiToolCall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiToolCall_conversationId_idx" ON "AiToolCall"("conversationId");

CREATE INDEX "AiToolCall_conversationId_createdAt_idx" ON "AiToolCall"("conversationId", "createdAt");

ALTER TABLE "AiToolCall" ADD CONSTRAINT "AiToolCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
