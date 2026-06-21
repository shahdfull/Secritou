-- CreateEnum
CREATE TYPE "CustomQuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateTable
CREATE TABLE "CustomQuestion" (
    "id" TEXT NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "status" "CustomQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CustomQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomQuestionMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "authorId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomQuestionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomQuestion_userId_idx" ON "CustomQuestion"("userId");

-- CreateIndex
CREATE INDEX "CustomQuestion_companyId_idx" ON "CustomQuestion"("companyId");

-- CreateIndex
CREATE INDEX "CustomQuestion_status_idx" ON "CustomQuestion"("status");

-- CreateIndex
CREATE INDEX "CustomQuestion_createdAt_idx" ON "CustomQuestion"("createdAt");

-- CreateIndex
CREATE INDEX "CustomQuestionMessage_questionId_idx" ON "CustomQuestionMessage"("questionId");

-- CreateIndex
CREATE INDEX "CustomQuestionMessage_questionId_createdAt_idx" ON "CustomQuestionMessage"("questionId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomQuestion" ADD CONSTRAINT "CustomQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomQuestion" ADD CONSTRAINT "CustomQuestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomQuestionMessage" ADD CONSTRAINT "CustomQuestionMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomQuestionMessage" ADD CONSTRAINT "CustomQuestionMessage_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CustomQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
