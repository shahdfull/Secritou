import { z } from "zod";

const messageContent = z.string().min(1).max(4000);

export const createConversationSchema = z.object({
  body: z.object({ message: messageContent }),
});

export const addMessageSchema = z.object({
  body: z.object({ message: messageContent }),
  params: z.object({ id: z.string().uuid() }),
});

export const deleteConversationSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const importSchema = z.object({
  body: z.object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(4000),
        })
      )
      .max(200),
  }),
});
