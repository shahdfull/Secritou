// Client Validators - Validation schemas
import { z } from "zod";
import { clientBaseSchema as sharedClientBase } from "@secritou/shared";

const clientBaseSchema = sharedClientBase.extend({});

export const createClientSchema = z.object({
  body: clientBaseSchema,
});

export const updateClientSchema = z.object({
  body: clientBaseSchema.partial(),
  params: z.object({
    id: z.string(),
  }),
});

// Param-only schemas for id-based actions (no request body).
const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }).strict(),
});

export const deleteClientSchema = idParamSchema;
export const archiveClientSchema = idParamSchema;

export const inviteClientUserSchema = z.object({
  params: z.object({ id: z.string().uuid() }).strict(),
  body: z
    .object({
      email: z.string().email(),
      name: z.string().min(1).max(255),
    })
    .strict(),
});
