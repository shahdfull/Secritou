import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
  projectId: z.string().min(1, "Project is required"),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const commentFormSchema = z.object({
  content: z.string().min(1, "Commentaire requis"),
});

export type CreateTaskForm = z.input<typeof createTaskSchema>;
export type UpdateTaskForm = z.input<typeof updateTaskSchema>;
export type CommentForm = z.input<typeof commentFormSchema>;
