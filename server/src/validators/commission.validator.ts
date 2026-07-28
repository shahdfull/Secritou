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

// RG-006 (refonte paiement à la tâche) : l'enveloppe est fixée explicitement par le CEO,
// jamais déduite automatiquement — null l'efface (retour à "non fixée", ce qui bloque à
// nouveau toute écriture de payoutAmount, voir LOT 3).
export const setProjectPayoutBudgetSchema = z.object({
  params: z.object({ projectId: uuidParam }),
  body: z.object({
    payoutBudget: z.number().positive().nullable(),
  }),
});
