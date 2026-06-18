import { z } from "zod";

export const createMissionSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  budget: z.coerce.number().positive().optional(),
});

export const updateMissionSchema = createMissionSchema.extend({
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

export type CreateMissionForm = z.infer<typeof createMissionSchema>;
export type UpdateMissionForm = z.infer<typeof updateMissionSchema>;
