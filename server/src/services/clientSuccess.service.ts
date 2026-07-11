import { clientSuccessRepository } from "../repositories/clientSuccess.repository.js";
import { prisma } from "../config/prisma.js";

export const clientSuccessService = {
  async getByClientId(clientId: string) {
    let success = await clientSuccessRepository.findByClientId(clientId);
    if (!success) {
      await clientSuccessRepository.create({ clientId });
      success = await clientSuccessRepository.findByClientId(clientId);
    }
    return success!;
  },

  async updateScore(clientId: string, score: number) {
    const success = await this.getByClientId(clientId);
    return clientSuccessRepository.update(success!.id, { score }, clientId);
  },

  async recalcAndPersist(clientId: string) {
    try {
      const score = await this.calculateScore(clientId);
      await this.updateScore(clientId, score);
    } catch {
      // Non-fatal: scoring failure must not break the triggering action.
    }
  },

  async recalcForSuccess(successId: string) {
    try {
      const success = await prisma.clientSuccess.findFirst({ where: { id: successId }, select: { clientId: true } });
      if (success) await this.recalcAndPersist(success.clientId);
    } catch {
      // Non-fatal.
    }
  },

  async calculateScore(clientId: string) {
    const success = await this.getByClientId(clientId);
    if (!success) return 0;

    let manualScore = 0;

    const completedObjectives = success.objectives.filter((o) => o.completedAt !== null).length;
    if (success.objectives.length > 0) manualScore += (completedObjectives / success.objectives.length) * 20;

    let totalImprovement = 0;
    for (const metric of success.metrics) {
      const cur = Number(metric.currentValue);
      const ini = Number(metric.initialValue);
      if (cur > ini && ini !== 0) totalImprovement += ((cur - ini) / ini) * 100;
    }
    if (success.metrics.length > 0) manualScore += Math.min((totalImprovement / success.metrics.length) * 0.15, 15);

    const doneRecs = success.recommendations.filter((r) => r.status === "DONE").length;
    if (success.recommendations.length > 0) manualScore += (doneRecs / success.recommendations.length) * 15;

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [invoices, client, activeProjects] = await Promise.all([
      prisma.invoice.findMany({ where: { clientId, createdAt: { gte: twelveMonthsAgo }, status: { in: ["SENT", "PARTIAL", "PAID"] } }, select: { amount: true, amountPaid: true, sentAt: true, paidAt: true } }),
      prisma.client.findUnique({ where: { id: clientId }, select: { createdAt: true } }),
      prisma.project.count({ where: { clientId, status: { in: ["IN_PROGRESS", "COMPLETED"] }, updatedAt: { gte: sixMonthsAgo } } }),
    ]);

    let autoScore = 0;

    const totalBilled = invoices.reduce((s, i) => s + Number(i.amount), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
    if (totalBilled > 0) autoScore += (totalPaid / totalBilled) * 20;

    const delays = invoices.filter((i) => i.paidAt && i.sentAt).map((i) => (i.paidAt!.getTime() - i.sentAt!.getTime()) / (1000 * 60 * 60 * 24));
    if (delays.length > 0) {
      const avgDays = delays.reduce((s, d) => s + d, 0) / delays.length;
      if (avgDays <= 15) autoScore += 15;
      else if (avgDays <= 30) autoScore += 10;
      else if (avgDays <= 60) autoScore += 5;
    }

    if (activeProjects >= 1) autoScore += 10;

    if (client) {
      const ageMonths = (Date.now() - client.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (ageMonths >= 12) autoScore += 5;
      else if (ageMonths >= 6) autoScore += 3;
      else autoScore += 1;
    }

    return Math.round(Math.min(manualScore + autoScore, 100));
  },

  async addObjective(clientId: string, data: { title: string; description?: string; targetValue?: number; currentValue?: number; unit?: string; targetDate?: Date }) {
    const success = await this.getByClientId(clientId);
    return clientSuccessRepository.addObjective(success!.id, data, clientId);
  },

  async updateObjective(id: string, data: Partial<{ title: string; description: string; targetValue: number; currentValue: number; unit: string; targetDate: Date; completedAt: Date }>, clientId?: string) {
    const objective = await clientSuccessRepository.updateObjective(id, data, clientId);
    if (data.completedAt !== undefined) await this.recalcForSuccess(objective.successId);
    return objective;
  },

  async deleteObjective(id: string, clientId?: string) {
    return clientSuccessRepository.deleteObjective(id, clientId);
  },

  async addMetric(clientId: string, data: { name: string; initialValue: number; currentValue: number; unit?: string }) {
    const success = await this.getByClientId(clientId);
    const metric = await clientSuccessRepository.addMetric(success!.id, data, clientId);
    await clientSuccessRepository.addMetricHistory(metric.id, { value: data.currentValue }, clientId);
    return metric;
  },

  async updateMetric(id: string, data: Partial<{ name: string; initialValue: number; currentValue: number; unit: string }>, clientId?: string) {
    const metric = await clientSuccessRepository.updateMetric(id, data, clientId);
    if (data.currentValue !== undefined) await clientSuccessRepository.addMetricHistory(id, { value: data.currentValue }, clientId);
    await this.recalcForSuccess(metric.successId);
    return metric;
  },

  async deleteMetric(id: string, clientId?: string) {
    return clientSuccessRepository.deleteMetric(id, clientId);
  },

  async addRecommendation(clientId: string, data: { title: string; description?: string; priority?: "LOW" | "MEDIUM" | "HIGH"; status?: "PENDING" | "IN_PROGRESS" | "DONE" }) {
    const success = await this.getByClientId(clientId);
    return clientSuccessRepository.addRecommendation(success!.id, data, clientId);
  },

  async updateRecommendation(id: string, data: Partial<{ title: string; description: string; priority: "LOW" | "MEDIUM" | "HIGH"; status: "PENDING" | "IN_PROGRESS" | "DONE" }>, clientId?: string) {
    const recommendation = await clientSuccessRepository.updateRecommendation(id, data, clientId);
    if (data.status !== undefined) await this.recalcForSuccess(recommendation.successId);
    return recommendation;
  },

  async deleteRecommendation(id: string, clientId?: string) {
    return clientSuccessRepository.deleteRecommendation(id, clientId);
  },

  async addTimeline(clientId: string, data: { title: string; description?: string; eventType: string; date?: Date }) {
    const success = await this.getByClientId(clientId);
    return clientSuccessRepository.addTimeline(success!.id, { ...data, date: data.date || new Date() }, clientId);
  },

  async deleteTimeline(id: string, clientId?: string) {
    return clientSuccessRepository.deleteTimeline(id, clientId);
  },
};
