import { clientSuccessRepository } from "../repositories/clientSuccess.repository.js";
import { prisma } from "../config/prisma.js";
import { tenantValidation } from "./tenantValidation.service.js";

export const clientSuccessService = {
  async getByClientId(clientId: string, companyId: string) {
    await tenantValidation.assertClientInCompany(clientId, companyId);
    let success = await clientSuccessRepository.findByClientId(clientId, companyId);
    if (!success) {
      // Auto-create if doesn't exist
      success = await clientSuccessRepository.create({
        clientId,
        companyId,
      });
    }
    return success;
  },

  async updateScore(clientId: string, companyId: string, score: number) {
    const success = await this.getByClientId(clientId, companyId);
    return clientSuccessRepository.update(success.id, companyId, { score });
  },

  async calculateScore(clientId: string, companyId: string) {
    const success = await this.getByClientId(clientId, companyId);
    if (!success) {
      return 0;
    }

    let score = 0;

    // Objectives completion
    const completedObjectives = success.objectives.filter((obj) => obj.completedAt !== null).length;
    if (success.objectives.length > 0) {
      score += (completedObjectives / success.objectives.length) * 40;
    }

    // Metrics improvement
    let totalImprovement = 0;
    for (const metric of success.metrics) {
      const currentValue = Number(metric.currentValue);
      const initialValue = Number(metric.initialValue);
      if (currentValue > initialValue && initialValue !== 0) {
        totalImprovement += ((currentValue - initialValue) / initialValue) * 100;
      }
    }
    if (success.metrics.length > 0) {
      const avgImprovement = totalImprovement / success.metrics.length;
      score += Math.min(avgImprovement * 0.3, 30);
    }

    // Recommendations done
    const doneRecommendations = success.recommendations.filter((rec) => rec.status === "DONE").length;
    if (success.recommendations.length > 0) {
      score += (doneRecommendations / success.recommendations.length) * 30;
    }

    return Math.round(Math.min(score, 100));
  },

  async addObjective(
    clientId: string,
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
    const success = await this.getByClientId(clientId, companyId);
    return clientSuccessRepository.addObjective(success.id, companyId, data);
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
    return clientSuccessRepository.updateObjective(id, companyId, data);
  },

  async deleteObjective(id: string, companyId: string) {
    return clientSuccessRepository.deleteObjective(id, companyId);
  },

  async addMetric(
    clientId: string,
    companyId: string,
    data: {
      name: string;
      initialValue: number;
      currentValue: number;
      unit?: string;
    }
  ) {
    const success = await this.getByClientId(clientId, companyId);
    const metric = await clientSuccessRepository.addMetric(success.id, companyId, data);
    await clientSuccessRepository.addMetricHistory(metric.id, companyId, {
      value: data.currentValue,
    });
    return metric;
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
    const metric = await clientSuccessRepository.updateMetric(id, companyId, data);
    if (data.currentValue !== undefined) {
      await clientSuccessRepository.addMetricHistory(id, companyId, { value: data.currentValue });
    }
    return metric;
  },

  async deleteMetric(id: string, companyId: string) {
    return clientSuccessRepository.deleteMetric(id, companyId);
  },

  async addRecommendation(
    clientId: string,
    companyId: string,
    data: {
      title: string;
      description?: string;
      priority?: number;
      status?: string;
    }
  ) {
    const success = await this.getByClientId(clientId, companyId);
    return clientSuccessRepository.addRecommendation(success.id, companyId, data);
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
    return clientSuccessRepository.updateRecommendation(id, companyId, data);
  },

  async deleteRecommendation(id: string, companyId: string) {
    return clientSuccessRepository.deleteRecommendation(id, companyId);
  },

  async addTimeline(
    clientId: string,
    companyId: string,
    data: {
      title: string;
      description?: string;
      eventType: string;
      date?: Date;
    }
  ) {
    const success = await this.getByClientId(clientId, companyId);
    return clientSuccessRepository.addTimeline(success.id, companyId, {
      ...data,
      date: data.date || new Date(),
    });
  },

  async deleteTimeline(id: string, companyId: string) {
    return clientSuccessRepository.deleteTimeline(id, companyId);
  },
};
