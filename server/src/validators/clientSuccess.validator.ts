import { z } from "zod";

const uuidParam = z.string().uuid();
const positiveDecimal = z.number().nonnegative();

export const updateScoreSchema = z.object({
  params: z.object({ clientId: uuidParam }),
  body: z.object({
    score: z.number().int().min(0).max(100),
  }),
});

export const addObjectiveSchema = z.object({
  params: z.object({ clientId: uuidParam }),
  body: z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    targetValue: positiveDecimal.optional(),
    currentValue: positiveDecimal.optional(),
    unit: z.string().max(50).optional(),
    targetDate: z.string().datetime({ offset: true }).optional(),
  }),
});

export const updateObjectiveSchema = z.object({
  params: z.object({ clientId: uuidParam, objectiveId: uuidParam }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    targetValue: positiveDecimal.optional(),
    currentValue: positiveDecimal.optional(),
    unit: z.string().max(50).optional(),
    targetDate: z.string().datetime({ offset: true }).optional().nullable(),
    completedAt: z.string().datetime({ offset: true }).optional().nullable(),
  }),
});

export const addMetricSchema = z.object({
  params: z.object({ clientId: uuidParam }),
  body: z.object({
    name: z.string().min(1).max(255),
    value: z.number(),
    unit: z.string().max(50).optional(),
    period: z.string().max(100).optional(),
  }),
});

export const updateMetricSchema = z.object({
  params: z.object({ clientId: uuidParam, metricId: uuidParam }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    value: z.number().optional(),
    unit: z.string().max(50).optional(),
    period: z.string().max(100).optional(),
  }),
});

export const addRecommendationSchema = z.object({
  params: z.object({ clientId: uuidParam }),
  body: z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  }),
});

export const updateRecommendationSchema = z.object({
  params: z.object({ clientId: uuidParam, recommendationId: uuidParam }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  }),
});

export const addTimelineSchema = z.object({
  params: z.object({ clientId: uuidParam }),
  body: z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    date: z.string().datetime({ offset: true }).optional(),
  }),
});
