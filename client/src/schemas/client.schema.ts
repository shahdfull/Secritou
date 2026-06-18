import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientForm = z.input<typeof createClientSchema>;
export type UpdateClientForm = z.input<typeof updateClientSchema>;
