import { z } from "zod";

export const createProfileSchema = z.object({
  bio: z.string().optional(),
  hourlyRate: z.coerce.number().positive().optional(),
  skills: z.string().optional(),
});

export const updateProfileSchema = z.object({
  bio: z.string().optional(),
  hourlyRate: z.coerce.number().positive().optional(),
  availability: z.boolean().optional(),
  skills: z.string().optional(),
});

export type CreateProfileForm = z.input<typeof createProfileSchema>;
export type UpdateProfileForm = z.input<typeof updateProfileSchema>;
