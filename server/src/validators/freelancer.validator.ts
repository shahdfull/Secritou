// Freelancer Validators - Validation schemas (profiles only; missions removed)
import { z } from "zod";
import { profileBaseSchema as sharedProfileBase } from "@secritou/shared";

const freelancerProfileBaseSchema = sharedProfileBase.extend({
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
