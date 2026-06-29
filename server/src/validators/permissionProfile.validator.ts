import { z } from "zod";

const uuidParam = z.string().uuid();

// permissions is a freeform module→action map (JSON column); keep it as an
// object record rather than z.any() so the payload is still constrained to an object.
const permissionsSchema = z.record(z.unknown());

export const createPermissionProfileSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).max(255),
      description: z.string().max(2000).optional(),
      permissions: permissionsSchema,
      isDefault: z.boolean().optional(),
    })
    .strict(),
});

export const updatePermissionProfileSchema = z.object({
  params: z.object({ id: uuidParam }).strict(),
  body: z
    .object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().max(2000).optional(),
      permissions: permissionsSchema.optional(),
      isDefault: z.boolean().optional(),
    })
    .strict(),
});

export const deletePermissionProfileSchema = z.object({
  params: z.object({ id: uuidParam }).strict(),
});
