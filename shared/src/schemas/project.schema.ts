import { z } from "zod";

export const PROJECT_STATUSES = ["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// Bounds mirror schema.prisma#Project's actual column widths (SEC-104); description is
// @db.Text (unbounded in Postgres) but still capped here for the same reason as elsewhere.
export const projectBaseSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  status: z.enum(PROJECT_STATUSES).default("PLANNING"),
  clientId: z.string().optional(),
});

export const createProjectSchema = projectBaseSchema;
export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectForm = z.input<typeof createProjectSchema>;
export type UpdateProjectForm = z.input<typeof updateProjectSchema>;

// Single source of truth for which status changes are allowed, enforced server-side in
// project.service.ts#updateProject and mirrored client-side to disable invalid options in
// the status picker — kept here so the two can never silently drift apart again.
export const PROJECT_STATUS_VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  PLANNING: ["IN_PROGRESS"],
  IN_PROGRESS: ["PLANNING", "REVIEW"],
  REVIEW: ["IN_PROGRESS"],
  COMPLETED: [],
};

export const PROJECT_STATUS_LABELS_FR: Record<ProjectStatus, string> = {
  PLANNING: "Planification",
  IN_PROGRESS: "En cours",
  REVIEW: "Révision",
  COMPLETED: "Terminé",
};
