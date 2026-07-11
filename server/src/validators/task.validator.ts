// Validators for Tasks
import { z } from "zod";
import { TaskStatus } from "@prisma/client";
import { taskBaseSchema as sharedTaskBase } from "@secritou/shared";

const taskBaseSchema = sharedTaskBase.extend({
  status: z.nativeEnum(TaskStatus).optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
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

export const getFreelancerAvailabilitySchema = z.object({
  query: z.object({
    freelancerId: z.string().min(1),
    startDate: z.string().transform((str) => new Date(str)),
    endDate: z.string().transform((str) => new Date(str)),
    excludeTaskId: z.string().optional(),
  }),
});

export const addTaskCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
  }),
  params: z.object({
    taskId: z.string(),
  }),
});
