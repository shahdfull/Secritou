-- CreateIndex
CREATE INDEX "Project_status_archivedAt_deadline_idx" ON "Project"("status", "archivedAt", "deadline");

-- CreateIndex
CREATE INDEX "Task_assigneeId_dueDate_idx" ON "Task"("assigneeId", "dueDate");
