import { z } from "zod";

export const userBaseSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "MANAGER", "CLIENT", "FREELANCER"]),
  serviceId: z.string().min(1).nullable().optional(),
});

export const inviteUserSchema = userBaseSchema.refine(
  (data) => data.role !== "MANAGER" || !!data.serviceId,
  { message: "serviceId is required when role is MANAGER", path: ["serviceId"] }
);
export const updateUserSchema = userBaseSchema.partial();

export type InviteUserForm = z.infer<typeof inviteUserSchema>;
export type UpdateUserForm = z.infer<typeof updateUserSchema>;
