import { z } from "zod";

export const taskBaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
  projectId: z.string().min(1),
  assigneeId: z.string().optional(),
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
