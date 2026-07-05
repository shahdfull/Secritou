-- Add priority field to Task model
ALTER TABLE "Task" ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'NORMAL';

-- Add TASK_DEADLINE_SOON to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE 'TASK_DEADLINE_SOON';
