import { z } from "zod";

// Bounds mirror schema.prisma#Client's actual column widths (SEC-104).
export const clientBaseSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
});

export const createClientSchema = clientBaseSchema;
export const updateClientSchema = createClientSchema.partial();

export type CreateClientForm = z.input<typeof createClientSchema>;
export type UpdateClientForm = z.input<typeof updateClientSchema>;
