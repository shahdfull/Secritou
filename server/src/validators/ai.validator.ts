import { z } from "zod";

const chatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const chatSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(4000),
    history: z.array(chatMessage).max(20).default([]),
  }),
});

export const generateBriefSchema = z.object({
  body: z.object({
    context: z.record(z.any()),
  }),
});

export const generateTasksSchema = z.object({
  body: z.object({
    context: z.record(z.any()),
  }),
});
