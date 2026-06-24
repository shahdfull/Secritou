import { prisma } from "../config/prisma.js";
import type { ClientSuccess } from "@prisma/client";

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

  async update(id: string, data: Partial<{ score: number }>) {
    return prisma.clientSuccess.update({ where: { id }, data });
  },

  async addObjective(successId: string, data: { title: string; description?: string; targetValue?: number; currentValue?: number; unit?: string; targetDate?: Date }) {
    await prisma.clientSuccess.findUniqueOrThrow({ where: { id: successId }, select: { id: true } });
    return prisma.successObjective.create({ data: { ...data, successId } });
  },

  async updateObjective(id: string, data: Partial<{ title: string; description: string; targetValue: number; currentValue: number; unit: string; targetDate: Date; completedAt: Date }>) {
    return prisma.successObjective.update({ where: { id }, data });
  },

  async deleteObjective(id: string) {
    return prisma.successObjective.delete({ where: { id } });
  },

  async addMetric(successId: string, data: { name: string; initialValue: number; currentValue: number; unit?: string }) {
    await prisma.clientSuccess.findUniqueOrThrow({ where: { id: successId }, select: { id: true } });
    return prisma.successMetric.create({ data: { ...data, successId } });
  },

  async updateMetric(id: string, data: Partial<{ name: string; initialValue: number; currentValue: number; unit: string }>) {
    return prisma.successMetric.update({ where: { id }, data });
  },

  async deleteMetric(id: string) {
    return prisma.successMetric.delete({ where: { id } });
  },

  async addMetricHistory(metricId: string, data: { value: number; date?: Date }) {
    await prisma.successMetric.findUniqueOrThrow({ where: { id: metricId }, select: { id: true } });
    return prisma.metricHistory.create({ data: { ...data, metricId } });
  },

  async addRecommendation(successId: string, data: { title: string; description?: string; priority?: "LOW" | "MEDIUM" | "HIGH"; status?: "PENDING" | "IN_PROGRESS" | "DONE" }) {
    await prisma.clientSuccess.findUniqueOrThrow({ where: { id: successId }, select: { id: true } });
    return prisma.successRecommendation.create({ data: { ...data, successId } });
  },

  async updateRecommendation(id: string, data: Partial<{ title: string; description: string; priority: "LOW" | "MEDIUM" | "HIGH"; status: "PENDING" | "IN_PROGRESS" | "DONE" }>) {
    return prisma.successRecommendation.update({ where: { id }, data });
  },

  async deleteRecommendation(id: string) {
    return prisma.successRecommendation.delete({ where: { id } });
  },

  async addTimeline(successId: string, data: { title: string; description?: string; eventType: string; date?: Date }) {
    await prisma.clientSuccess.findUniqueOrThrow({ where: { id: successId }, select: { id: true } });
    return prisma.successTimeline.create({ data: { ...data, successId } });
  },

  async deleteTimeline(id: string) {
    return prisma.successTimeline.delete({ where: { id } });
  },
};
