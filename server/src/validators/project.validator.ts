// Validators for Projects
import { z } from "zod";
import { ProjectStatus } from "@prisma/client";
import { projectBaseSchema as sharedProjectBase } from "@secritou/shared";

const projectBaseSchema = sharedProjectBase.extend({
  status: z.nativeEnum(ProjectStatus).optional(),
  serviceId: z.string().uuid().optional(),
});

export const createProjectSchema = z.object({
  body: projectBaseSchema.extend({
    proposalId: z.string().uuid(),
  }),
});

export const updateProjectSchema = z.object({
  body: projectBaseSchema.partial(),
  params: z.object({
    id: z.string(),
  }),
});

// SEC-091: batched CLIENT portal summaries (timeline + completed tasks) for multiple project
// cards in one call. Capped at 100 — matches /projects/my's own pageSize cap (a client can never
// have more visible cards than that in a single page load).
export const getPortalSummariesSchema = z.object({
  query: z.object({
    ids: z
      .string()
      .min(1)
      .transform((raw) => raw.split(",").map((s) => s.trim()).filter(Boolean))
      .pipe(z.array(z.string().uuid()).min(1).max(100)),
  }),
});
