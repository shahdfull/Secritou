import { z } from "zod";
import { Role } from "@prisma/client";

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    role: z.nativeEnum(Role),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    role: z.nativeEnum(Role).optional(),
  }),
  params: z.object({
    id: z.string(),
  }),
});
