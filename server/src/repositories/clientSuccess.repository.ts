import { prisma } from "../config/prisma.js";
import type { ClientSuccess } from "@prisma/client";

export const clientSuccessRepository = {
  async findByClientId(clientId: string, companyId: string) {
    return prisma.clientSuccess.findFirst({
      where: { clientId, client: { companyId } },
      include: {
        client: true,
        objectives: { orderBy: { createdAt: "desc" } },
        metrics: {
          include: { history: { orderBy: { date: "desc" }, take: 30 } },
        },
        recommendations: { orderBy: { priority: "desc" } },
        timeline: { orderBy: { date: "desc" } },
      },
    });
  },

  async create(data: { clientId: string; companyId: string; score?: number }) {
    return prisma.clientSuccess.create({ data });
  },

  async update(id: string, companyId: string, data: Partial<{ score: number }>) {
    await prisma.clientSuccess.findFirstOrThrow({
      where: { id, client: { companyId } },
      select: { id: true },
    });
    return prisma.clientSuccess.update({ where: { id }, data });
  },

  async addObjective(
    successId: string,
    companyId: string,
    data: {
      title: string;
      description?: string;
      targetValue?: number;
      currentValue?: number;
      unit?: string;
      targetDate?: Date;
    }
  ) {
    await prisma.clientSuccess.findFirstOrThrow({
      where: { id: successId, client: { companyId } },
      select: { id: true },
    });
    return prisma.successObjective.create({ data: { ...data, successId } });
  },

  async updateObjective(
    id: string,
    companyId: string,
    data: Partial<{
      title: string;
      description: string;
      targetValue: number;
      currentValue: number;
      unit: string;
      targetDate: Date;
      completedAt: Date;
    }>
  ) {
    return prisma.successObjective.update({ where: { id }, data });
  },

  async deleteObjective(id: string, companyId: string) {
    return prisma.successObjective.delete({ where: { id } });
  },

  async addMetric(
    successId: string,
    companyId: string,
    data: {
      name: string;
      initialValue: number;
      currentValue: number;
      unit?: string;
    }
  ) {
    await prisma.clientSuccess.findFirstOrThrow({
      where: { id: successId, client: { companyId } },
      select: { id: true },
    });
    return prisma.successMetric.create({ data: { ...data, successId } });
  },

  async updateMetric(
    id: string,
    companyId: string,
    data: Partial<{
      name: string;
      initialValue: number;
      currentValue: number;
      unit: string;
    }>
  ) {
    return prisma.successMetric.update({ where: { id }, data });
  },

  async deleteMetric(id: string, companyId: string) {
    return prisma.successMetric.delete({ where: { id } });
  },

  async addMetricHistory(
    metricId: string,
    companyId: string,
    data: { value: number; date?: Date }
  ) {
    await prisma.successMetric.findFirstOrThrow({
      where: { id: metricId, success: { client: { companyId } } },
      select: { id: true },
    });
    return prisma.metricHistory.create({ data: { ...data, metricId } });
  },

  async addRecommendation(
    successId: string,
    companyId: string,
    data: {
      title: string;
      description?: string;
      priority?: number;
      status?: string;
    }
  ) {
    await prisma.clientSuccess.findFirstOrThrow({
      where: { id: successId, client: { companyId } },
      select: { id: true },
    });
    return prisma.successRecommendation.create({ data: { ...data, successId } });
  },

  async updateRecommendation(
    id: string,
    companyId: string,
    data: Partial<{
      title: string;
      description: string;
      priority: number;
      status: string;
    }>
  ) {
    return prisma.successRecommendation.update({ where: { id }, data });
  },

  async deleteRecommendation(id: string, companyId: string) {
    return prisma.successRecommendation.delete({ where: { id } });
  },

  async addTimeline(
    successId: string,
    companyId: string,
    data: {
      title: string;
      description?: string;
      eventType: string;
      date?: Date;
    }
  ) {
    await prisma.clientSuccess.findFirstOrThrow({
      where: { id: successId, client: { companyId } },
      select: { id: true },
    });
    return prisma.successTimeline.create({ data: { ...data, successId } });
  },

  async deleteTimeline(id: string, companyId: string) {
    return prisma.successTimeline.delete({ where: { id } });
  },
};
