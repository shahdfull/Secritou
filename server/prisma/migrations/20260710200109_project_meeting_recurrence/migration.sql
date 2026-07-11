-- CreateEnum
CREATE TYPE "MeetingFrequency" AS ENUM ('NONE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MEETING_REMINDER';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "meetingFrequency" "MeetingFrequency" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "nextMeetingDate" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "Project_nextMeetingDate_idx" ON "Project"("nextMeetingDate");
