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
