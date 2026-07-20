import { z } from "zod";

// bio mirrors schema.prisma#FreelancerProfile.bio (@db.Text, unbounded in Postgres but still
// capped here per SEC-104); skills is a CSV string on this form (not the Skill[] relation it
// becomes server-side), bounded generously for the same reason.
export const profileBaseSchema = z.object({
  bio: z.string().max(5000).optional(),
  hourlyRate: z.coerce.number().positive().optional(),
  skills: z.string().max(1000).optional(),
});

export const createProfileSchema = profileBaseSchema;
export const updateProfileSchema = profileBaseSchema.extend({
  availability: z.boolean().optional(),
});

export type CreateProfileForm = z.input<typeof createProfileSchema>;
export type UpdateProfileForm = z.input<typeof updateProfileSchema>;
