// Validators for Companies
import { z } from "zod";

const companyBaseSchema = z.object({
  name: z.string().min(2),
  website: z.string().url().optional(),
});

export const createCompanySchema = z.object({
  body: companyBaseSchema,
});

export const updateCompanySchema = z.object({
  body: companyBaseSchema.partial(),
});
