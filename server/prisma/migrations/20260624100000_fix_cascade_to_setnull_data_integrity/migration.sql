-- Fix #1: User → Client: onDelete Cascade → SetNull
-- Deleting a user no longer destroys the entire Client record and all its data
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_clientId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fix #2: Document.uploadedById → User: onDelete Cascade → SetNull
-- Make uploadedById nullable and change constraint so deleting a user preserves documents
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_uploadedById_fkey";
ALTER TABLE "Document" ALTER COLUMN "uploadedById" DROP NOT NULL;
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fix #3: Comment.authorId → User: onDelete Cascade → SetNull
-- Deleting a user preserves task comment history (authorId becomes NULL)
ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_authorId_fkey";
ALTER TABLE "Comment" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fix #4: ServiceRequestComment.authorId → User: onDelete Cascade → SetNull
-- Deleting a user preserves service request comment history (authorId becomes NULL)
ALTER TABLE "ServiceRequestComment" DROP CONSTRAINT IF EXISTS "ServiceRequestComment_authorId_fkey";
ALTER TABLE "ServiceRequestComment" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "ServiceRequestComment" ADD CONSTRAINT "ServiceRequestComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
