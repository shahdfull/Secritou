import { z } from "zod";

const uuidParam = z.string().uuid();

// overrides is a freeform module→action map (JSON column); allow null to clear it.
const overridesSchema = z.record(z.unknown());

export const updateManagerPermissionSchema = z.object({
  params: z.object({ userId: uuidParam }).strict(),
  body: z
    .object({
      profileId: z.string().uuid().nullable().optional(),
      overrides: overridesSchema.nullable().optional(),
    })
    .strict(),
});
