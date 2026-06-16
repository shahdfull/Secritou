// Client Validators - Validation schemas
import { z } from "zod";

const clientBaseSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const createClientSchema = z.object({
  body: clientBaseSchema,
});

export const updateClientSchema = z.object({
  body: clientBaseSchema.partial(),
  params: z.object({
    id: z.string(),
  }),
});
