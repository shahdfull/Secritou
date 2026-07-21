-- SEC-173: 20260719200000_add_task_completedat_comment_editedat added Task.completedAt with no
-- backfill — any task already DONE before that migration keeps completedAt = null permanently
-- (the field is only written by task.service.ts#update on a live transition to DONE, never
-- retroactively). Confirmed no code currently reads Task.completedAt for any aggregation (grep
-- across server/src found zero consumers besides the write path itself), so this backfill has no
-- observable behavior change today — it only prevents the field from silently under-reporting
-- once a future feature (e.g. average completion time) starts consuming it. Approximation:
-- updatedAt is a reasonable proxy for "when this task was completed" on historical DONE tasks,
-- since it's the last modification timestamp and DONE is typically a task's final transition.
UPDATE "Task" SET "completedAt" = "updatedAt" WHERE "status" = 'DONE' AND "completedAt" IS NULL;
