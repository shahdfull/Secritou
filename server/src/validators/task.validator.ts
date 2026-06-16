// Validators for Tasks
import { z } from "zod";
import { TaskStatus } from "@prisma/client";

const taskBaseSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueDate: z.string().transform((str) => new Date(str)).optional(),
  projectId: z.string().uuid(),
  assigneeId: z.string().uuid().optional(),
});

export const createTaskSchema = z.object({
  body: taskBaseSchema,
});

export const updateTaskSchema = z.object({
  body: taskBaseSchema.partial(),
  params: z.object({
    id: z.string(),
  }),
});
