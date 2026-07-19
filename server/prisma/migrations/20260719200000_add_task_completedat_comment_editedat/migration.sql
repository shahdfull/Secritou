-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "editedAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completedAt" TIMESTAMPTZ(6);
