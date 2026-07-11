import { z } from "zod";

const uuidParam = z.string().uuid();

export const projectIdParamSchema = z.object({
  params: z.object({ projectId: uuidParam }),
});

export const commissionIdParamSchema = z.object({
  params: z.object({ id: uuidParam }),
});

export const setCommissionSplitsSchema = z.object({
  params: z.object({ projectId: uuidParam }),
  body: z.object({
    splits: z.array(z.object({
      partnerId: z.string().uuid(),
      ratePct: z.number().positive().max(100),
    })).max(10),
  }),
});
