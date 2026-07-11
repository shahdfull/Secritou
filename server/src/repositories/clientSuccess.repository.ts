import { prisma } from "../config/prisma.js";
import type { ClientSuccess } from "@prisma/client";
import { HttpError } from "../utils/httpError.js";

export const clientSuccessRepository = {
  async findByClientId(clientId: string) {
    return prisma.clientSuccess.findFirst({
      where: { clientId },
      include: {
        client: true,
        objectives: { orderBy: { createdAt: "desc" } },
        metrics: { include: { history: { orderBy: { date: "desc" }, take: 30 } } },
        recommendations: { orderBy: { createdAt: "desc" } },
        timeline: { orderBy: { date: "desc" } },
      },
    });
  },

  async create(data: { clientId: string; score?: number }): Promise<ClientSuccess> {
    return prisma.clientSuccess.create({ data });
  },

  async update(id: string, data: Partial<{ score: number }>, clientId?: string) {
    if (clientId) {
      await prisma.clientSuccess.findFirstOrThrow({ where: { id, clientId } });
    }
    return prisma.clientSuccess.update({ where: { id }, data });
  },

  async addObjective(successId: string, data: { title: string; description?: string; targetValue?: number; currentValue?: number; unit?: string; targetDate?: Date }, clientId?: string) {
    if (clientId) {
      await prisma.clientSuccess.findFirstOrThrow({ where: { id: successId, clientId } });
    } else {
      await prisma.clientSuccess.findUniqueOrThrow({ where: { id: successId }, select: { id: true } });
    }
    return prisma.successObjective.create({ data: { ...data, successId } });
  },

  async updateObjective(id: string, data: Partial<{ title: string; description: string; targetValue: number; currentValue: number; unit: string; targetDate: Date; completedAt: Date }>, clientId?: string) {
    if (clientId) {
      await prisma.successObjective.findFirstOrThrow({ where: { id, success: { clientId } } });
    }
    return prisma.successObjective.update({ where: { id }, data });
  },

  async deleteObjective(id: string, clientId?: string) {
    if (clientId) {
      await prisma.successObjective.findFirstOrThrow({ where: { id, success: { clientId } } });
    }
    return prisma.successObjective.delete({ where: { id } });
  },

  async addMetric(successId: string, data: { name: string; initialValue: number; currentValue: number; unit?: string }, clientId?: string) {
    if (clientId) {
      await prisma.clientSuccess.findFirstOrThrow({ where: { id: successId, clientId } });
    } else {
      await prisma.clientSuccess.findUniqueOrThrow({ where: { id: successId }, select: { id: true } });
    }
    return prisma.successMetric.create({ data: { ...data, successId } });
  },

  async updateMetric(id: string, data: Partial<{ name: string; initialValue: number; currentValue: number; unit: string }>, clientId?: string) {
    if (clientId) {
      await prisma.successMetric.findFirstOrThrow({ where: { id, success: { clientId } } });
    }
    return prisma.successMetric.update({ where: { id }, data });
  },

  async deleteMetric(id: string, clientId?: string) {
    if (clientId) {
      await prisma.successMetric.findFirstOrThrow({ where: { id, success: { clientId } } });
    }
    return prisma.successMetric.delete({ where: { id } });
  },

  async addMetricHistory(metricId: string, data: { value: number; date?: Date }, clientId?: string) {
    if (clientId) {
      await prisma.successMetric.findFirstOrThrow({ where: { id: metricId, success: { clientId } } });
    } else {
      await prisma.successMetric.findUniqueOrThrow({ where: { id: metricId }, select: { id: true } });
    }
    return prisma.metricHistory.create({ data: { ...data, metricId } });
  },

  async addRecommendation(successId: string, data: { title: string; description?: string; priority?: "LOW" | "MEDIUM" | "HIGH"; status?: "PENDING" | "IN_PROGRESS" | "DONE" }, clientId?: string) {
    if (clientId) {
      await prisma.clientSuccess.findFirstOrThrow({ where: { id: successId, clientId } });
    } else {
      await prisma.clientSuccess.findUniqueOrThrow({ where: { id: successId }, select: { id: true } });
    }
    return prisma.successRecommendation.create({ data: { ...data, successId } });
  },

  async updateRecommendation(id: string, data: Partial<{ title: string; description: string; priority: "LOW" | "MEDIUM" | "HIGH"; status: "PENDING" | "IN_PROGRESS" | "DONE" }>, clientId?: string) {
    if (clientId) {
      await prisma.successRecommendation.findFirstOrThrow({ where: { id, success: { clientId } } });
    }
    return prisma.successRecommendation.update({ where: { id }, data });
  },

  async deleteRecommendation(id: string, clientId?: string) {
    if (clientId) {
      await prisma.successRecommendation.findFirstOrThrow({ where: { id, success: { clientId } } });
    }
    return prisma.successRecommendation.delete({ where: { id } });
  },

  async addTimeline(successId: string, data: { title: string; description?: string; eventType: string; date?: Date }, clientId?: string) {
    if (clientId) {
      await prisma.clientSuccess.findFirstOrThrow({ where: { id: successId, clientId } });
    } else {
      await prisma.clientSuccess.findUniqueOrThrow({ where: { id: successId }, select: { id: true } });
    }
    return prisma.successTimeline.create({ data: { ...data, successId } });
  },

  async deleteTimeline(id: string, clientId?: string) {
    if (clientId) {
      await prisma.successTimeline.findFirstOrThrow({ where: { id, success: { clientId } } });
    }
    return prisma.successTimeline.delete({ where: { id } });
  },
};
