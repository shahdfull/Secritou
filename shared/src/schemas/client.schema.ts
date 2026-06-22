import { z } from "zod";

export const clientBaseSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

export const createClientSchema = clientBaseSchema;
export const updateClientSchema = createClientSchema.partial();

export type CreateClientForm = z.input<typeof createClientSchema>;
export type UpdateClientForm = z.input<typeof updateClientSchema>;
