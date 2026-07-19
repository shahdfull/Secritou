import { z } from "zod";

export const getChecklistSchema = z.object({
  params: z.object({
    taskId: z.string(),
  }),
});

export const createChecklistItemSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
  }),
  params: z.object({
    taskId: z.string(),
  }),
});

export const updateChecklistItemSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    done: z.boolean().optional(),
  }),
  params: z.object({
    taskId: z.string(),
    itemId: z.string(),
  }),
});

export const deleteChecklistItemSchema = z.object({
  params: z.object({
    taskId: z.string(),
    itemId: z.string(),
  }),
});
