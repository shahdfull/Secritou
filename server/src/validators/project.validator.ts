// Validators for Projects
import { z } from "zod";
import { ProjectStatus } from "@prisma/client";

const projectBaseSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  clientId: z.string().uuid().optional(),
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
