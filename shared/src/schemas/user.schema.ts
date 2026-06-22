import { z } from "zod";

export const userBaseSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "MANAGER", "CLIENT", "FREELANCER"]),
});

export const inviteUserSchema = userBaseSchema;
export const updateUserSchema = userBaseSchema.partial();

export type InviteUserForm = z.infer<typeof inviteUserSchema>;
export type UpdateUserForm = z.infer<typeof updateUserSchema>;
