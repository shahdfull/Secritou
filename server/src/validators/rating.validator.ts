import { z } from "zod";

const scoreSchema = z.number().int().min(1).max(5);

export const createRatingSchema = z.object({
  body: z.object({
    freelancerId: z.string().uuid(),
    missionId: z.string().uuid(),
    score: scoreSchema,
    comment: z.string().max(2000).optional(),
  }),
});

export const updateRatingSchema = z.object({
  body: z.object({
    score: scoreSchema.optional(),
    comment: z.string().max(2000).optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
});

export const getRatingsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  }),
});
