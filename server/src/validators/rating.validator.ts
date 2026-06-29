import { z } from "zod";

export const addRatingSchema = z.object({
  params: z.object({ freelancerId: z.string().uuid() }).strict(),
  body: z
    .object({
      score: z.number().int().min(1).max(5),
      comment: z.string().max(2000).optional(),
    })
    .strict(),
});
