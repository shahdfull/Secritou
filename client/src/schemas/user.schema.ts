import { z } from "zod";

export const inviteUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["ADMIN", "MANAGER", "CLIENT", "FREELANCER"]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(["ADMIN", "MANAGER", "CLIENT", "FREELANCER"]),
});

export type InviteUserForm = z.infer<typeof inviteUserSchema>;
export type UpdateUserForm = z.infer<typeof updateUserSchema>;
