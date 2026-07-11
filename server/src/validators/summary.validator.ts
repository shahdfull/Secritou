// Validators for Summary routes
import { z } from "zod";

export const getClientSummarySchema = z.object({
  params: z.object({
    clientId: z.string().uuid(),
  }),
});

export const getProjectSummarySchema = z.object({
  params: z.object({
    projectId: z.string().uuid(),
  }),
});
