// Freelancer & Mission Validators - Validation schemas
import { z } from "zod";
import { MissionStatus } from "@prisma/client";

const freelancerProfileBaseSchema = z.object({
  bio: z.string().optional(),
  hourlyRate: z.number().positive().optional(),
  skillIds: z.array(z.string().uuid()).optional(),
});

const missionBaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  budget: z.number().positive().optional(),
  projectId: z.string().uuid().optional(),
});

export const createFreelancerProfileSchema = z.object({
  body: freelancerProfileBaseSchema,
});

export const updateFreelancerProfileSchema = z.object({
  body: z.object({
    ...freelancerProfileBaseSchema.shape,
    availability: z.boolean().optional(),
  }),
});

export const createMissionSchema = z.object({
  body: missionBaseSchema,
});

export const updateMissionSchema = z.object({
  body: z.object({
    ...missionBaseSchema.partial().shape,
    status: z.nativeEnum(MissionStatus).optional(),
    freelancerId: z.string().uuid().optional(),
  }),
  params: z.object({
    id: z.string(),
  }),
});
