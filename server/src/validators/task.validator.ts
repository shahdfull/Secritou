// Validators for Tasks
import { z } from "zod";
import { TaskStatus } from "@prisma/client";
import { taskBaseSchema as sharedTaskBase } from "@secritou/shared";

const taskBaseSchema = sharedTaskBase.extend({
  status: z.nativeEnum(TaskStatus).optional(),
  dueDate: z.string().transform((str) => new Date(str)).optional(),
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
