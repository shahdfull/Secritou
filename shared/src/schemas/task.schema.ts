import { z } from "zod";

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
export const TaskStatusEnum = z.enum(TASK_STATUSES);
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const taskBaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
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
  content: z.string().min(1),
});

export type CreateTaskForm = z.input<typeof createTaskSchema>;
export type UpdateTaskForm = z.input<typeof updateTaskSchema>;
export type CommentForm = z.input<typeof commentFormSchema>;
