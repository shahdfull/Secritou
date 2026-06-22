import { z } from "zod";
import { Role } from "@prisma/client";
import { userBaseSchema as sharedUserBase } from "@secritou/shared";

export const updateMeSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(255).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional().nullable(),
  }),
});

const userBaseSchema = sharedUserBase.extend({
  role: z.nativeEnum(Role),
});

export const createUserSchema = z.object({
  body: userBaseSchema,
});

export const updateUserSchema = z.object({
  body: userBaseSchema.partial(),
  params: z.object({
    id: z.string(),
  }),
});
