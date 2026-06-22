import { z } from "zod";

export const profileBaseSchema = z.object({
  bio: z.string().optional(),
  hourlyRate: z.coerce.number().positive().optional(),
  skills: z.string().optional(),
});

export const createProfileSchema = profileBaseSchema;
export const updateProfileSchema = profileBaseSchema.extend({
  availability: z.boolean().optional(),
});

export type CreateProfileForm = z.input<typeof createProfileSchema>;
export type UpdateProfileForm = z.input<typeof updateProfileSchema>;
