import { z } from "zod";

export const projectBaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"]).default("PLANNING"),
  clientId: z.string().optional(),
});

export const createProjectSchema = projectBaseSchema;
export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectForm = z.input<typeof createProjectSchema>;
export type UpdateProjectForm = z.input<typeof updateProjectSchema>;
