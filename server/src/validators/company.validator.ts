// Validators for Companies
import { z } from "zod";

const companyBaseSchema = z.object({
  name: z.string().min(2),
  website: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#?([0-9a-fA-F]{3}){1,2}$/).optional(),
});

export const createCompanySchema = z.object({
  body: companyBaseSchema,
});

export const updateCompanySchema = z.object({
  body: companyBaseSchema.partial(),
});
