// Validators for Tasks
import { z } from "zod";
import { TaskStatus } from "@prisma/client";
import { taskBaseSchema as sharedTaskBase } from "@secritou/shared";

// SEC-044: previously `(s) => !isNaN(Date.parse(s))`, which accepted anything Date.parse tolerates
// ("March 3", "2024/1/1", "Sat Jan 01 2024"), far looser than the project-meeting validator
// (strict ISO with offset). The client sends `YYYY-MM-DD` (from <input type="date">) for tasks and
// a full ISO string for meetings, so the documented convention is: accept a calendar date
// (YYYY-MM-DD) OR a full ISO 8601 datetime, and reject everything else. This rejects the loose
// free-text forms above while keeping every real client payload valid.
const ISO_DATE_OR_DATETIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
const isValidDateString = (s: string) => ISO_DATE_OR_DATETIME.test(s) && !isNaN(Date.parse(s));

const taskBaseSchema = sharedTaskBase.extend({
  status: z.nativeEnum(TaskStatus).optional(),
  startDate: z.string().refine(isValidDateString, "Invalid date").transform((str) => new Date(str)).optional(),
  dueDate: z.string().refine(isValidDateString, "Invalid date").transform((str) => new Date(str)).optional(),
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
    startDate: z.string().refine(isValidDateString, "Invalid date").transform((str) => new Date(str)),
    endDate: z.string().refine(isValidDateString, "Invalid date").transform((str) => new Date(str)),
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

export const updateTaskCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
  }),
  params: z.object({
    taskId: z.string(),
    commentId: z.string(),
  }),
});

export const deleteTaskCommentSchema = z.object({
  params: z.object({
    taskId: z.string(),
    commentId: z.string(),
  }),
});

// SEC-060 (actions en masse): capped at 100 per call — mirrors the Kanban's own 200-task load
// cap (TasksKanban.tsx) as a sane upper bound, not an arbitrary number; a larger selection should
// be split into multiple calls by the client rather than accepted here.
export const bulkUpdateTaskStatusSchema = z.object({
  body: z.object({
    taskIds: z.array(z.string().uuid()).min(1).max(100),
    status: z.nativeEnum(TaskStatus),
  }),
});

export const bulkDeleteTasksSchema = z.object({
  body: z.object({
    taskIds: z.array(z.string().uuid()).min(1).max(100),
  }),
});
