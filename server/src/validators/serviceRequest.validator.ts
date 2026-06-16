import { z } from "zod";

const serviceRequestBaseSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
});

export const createServiceRequestSchema = z.object({
  body: serviceRequestBaseSchema,
});

export const updateServiceRequestSchema = z.object({
  body: z.object({
    status: z.enum(["NEW", "IN_PROGRESS", "DONE"]).optional(),
    ...serviceRequestBaseSchema.partial().shape,
  }),
  params: z.object({
    id: z.string(),
  }),
});
