import { z } from "zod";

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
export const TaskStatusEnum = z.enum(TASK_STATUSES);
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// Single source of truth for which status changes are allowed, enforced server-side in
// task.service.ts#updateTask and mirrored client-side to disable invalid options in the
// status picker — kept here (mirroring PROJECT_STATUS_VALID_TRANSITIONS in
// project.schema.ts) so the two can never silently drift apart again.
// DONE -> REVIEW is allowed so a mistakenly-completed task can be corrected without losing
// its history/comments; DONE has no other way out, forcing a genuinely new scope of work
// into a new task.
export const ALLOWED_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["TODO", "REVIEW"],
  REVIEW: ["IN_PROGRESS", "DONE"],
  DONE: ["REVIEW"],
};

// title/description bounds mirror schema.prisma#Task's actual column widths (SEC-104);
// commentFormSchema's max(2000) mirrors the bound already enforced server-side
// (task.validator.ts), which this shared form-only schema had never matched.
export const taskBaseSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  status: TaskStatusEnum,
  priority: z.enum(TASK_PRIORITIES).optional(),
  projectId: z.string().min(1),
  assigneeId: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
});

export const createTaskSchema = taskBaseSchema;
export const updateTaskSchema = createTaskSchema.partial();
export const commentFormSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type CreateTaskForm = z.input<typeof createTaskSchema>;
export type UpdateTaskForm = z.input<typeof updateTaskSchema>;
export type CommentForm = z.input<typeof commentFormSchema>;
