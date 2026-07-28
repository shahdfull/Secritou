import { z } from "zod";
import { Role } from "@prisma/client";
import { userBaseSchema as sharedUserBase } from "@secritou/shared";

export const updateMeSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(255).optional(),
    phone: z.string().max(50).optional().nullable(),
  }),
});

export const requestEmailChangeSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const confirmEmailChangeSchema = z.object({
  body: z.object({
    token: z.string().min(1),
  }),
});

// RG-020 : seuil d'inactivité en minutes, ADMIN uniquement (voir REFERENTIEL.md §7,
// 2026-07-28). Borné à [1, 240] pour éviter une valeur absurde (0 = jamais de session,
// >4h = perd le sens d'un "timeout d'inactivité").
export const updateSessionIdleTimeoutSchema = z.object({
  body: z.object({
    minutes: z.number().int().min(1).max(240),
  }),
});

const userBaseSchema = sharedUserBase.extend({
  role: z.nativeEnum(Role),
});

export const createUserSchema = z.object({
  body: userBaseSchema.refine((data) => data.role !== "MANAGER" || !!data.serviceId, {
    message: "serviceId is required when role is MANAGER",
    path: ["serviceId"],
  }),
});

export const updateUserSchema = z.object({
  body: userBaseSchema.partial(),
  params: z.object({
    id: z.string(),
  }),
});
