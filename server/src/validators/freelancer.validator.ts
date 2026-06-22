// Freelancer Validators - Validation schemas (profiles only; missions removed)
import { z } from "zod";

const freelancerProfileBaseSchema = z.object({
  bio: z.string().optional(),
  hourlyRate: z.number().positive().optional(),
  skillIds: z.array(z.string().uuid()).optional(),
});

export const createFreelancerProfileSchema = z.object({
  body: freelancerProfileBaseSchema,
});

export const updateFreelancerProfileSchema = z.object({
  body: z.object({
    ...freelancerProfileBaseSchema.shape,
    availability: z.boolean().optional(),
  }),
});
