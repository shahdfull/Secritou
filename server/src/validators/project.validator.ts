// Validators for Projects
import { z } from "zod";
import { ProjectStatus } from "@prisma/client";
import { projectBaseSchema as sharedProjectBase } from "@secritou/shared";

const projectBaseSchema = sharedProjectBase.extend({
  status: z.nativeEnum(ProjectStatus).optional(),
  serviceId: z.string().uuid().optional(),
});

export const createProjectSchema = z.object({
  body: projectBaseSchema,
});

export const updateProjectSchema = z.object({
  body: projectBaseSchema.partial(),
  params: z.object({
    id: z.string(),
  }),
});
