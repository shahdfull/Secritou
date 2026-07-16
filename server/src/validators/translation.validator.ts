import { z } from "zod";

export const translateSchema = z.object({
  body: z.object({
    text: z.string().trim().min(1).max(5000),
  }),
});

export type TranslateInput = z.infer<typeof translateSchema>["body"];
