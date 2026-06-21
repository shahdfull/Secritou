import { z } from "zod";

// Create a new custom question (logged-in user)
export const createCustomQuestionSchema = z.object({
  body: z.object({
    subject: z.string().trim().min(5, "Subject must contain at least 5 characters").max(255),
    message: z.string().trim().min(10, "Message must contain at least 10 characters"),
  }),
});

// Add a message to an existing conversation thread
export const addCustomQuestionMessageSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1, "Message cannot be empty"),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

// Update the status of a question (admin only)
export const updateCustomQuestionStatusSchema = z.object({
  body: z.object({
    status: z.enum(["OPEN", "ANSWERED", "CLOSED"]),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export type CreateCustomQuestionInput = z.infer<typeof createCustomQuestionSchema>["body"];
export type AddMessageInput = z.infer<typeof addCustomQuestionMessageSchema>["body"];
