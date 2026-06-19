import { clientSuccessRepository } from "../repositories/clientSuccess.repository.js";
import { prisma } from "../config/prisma.js";
import { tenantValidation } from "./tenantValidation.service.js";

export const clientSuccessService = {
  async getByClientId(clientId: string, companyId: string) {
    await tenantValidation.assertClientInCompany(clientId, companyId);
    let success = await clientSuccessRepository.findByClientId(clientId, companyId);
    if (!success) {
      await clientSuccessRepository.create({ clientId, companyId });
      success = await clientSuccessRepository.findByClientId(clientId, companyId);
    }
    return success!
  },

  async updateScore(clientId: string, companyId: string, score: number) {
    const success = await this.getByClientId(clientId, companyId);
    return clientSuccessRepository.update(success!.id, companyId, { score });
  },

  /**
   * Recompute and persist a client's success score. Called automatically when the underlying
   * data changes (a payment is recorded, an objective/recommendation is completed) so the
   * displayed score isn't stale until the nightly batch runs. Best-effort: never throws into
   * the caller's flow, since scoring is a side effect of the primary action.
   */
  async recalcAndPersist(clientId: string, companyId: string) {
    try {
      const score = await this.calculateScore(clientId, companyId);
      await this.updateScore(clientId, companyId, score);
    } catch {
      // Non-fatal: a scoring failure must not break the payment/objective update that triggered it.
    }
  },

  /** Resolve the clientId behind a ClientSuccess id and recompute its score (best-effort). */
  async recalcForSuccess(successId: string, companyId: string) {
    try {
      const success = await prisma.clientSuccess.findFirst({
        where: { id: successId, client: { companyId } },
        select: { clientId: true },
      });
      if (success) await this.recalcAndPersist(success.clientId, companyId);
    } catch {
      // Non-fatal.
    }
  },

  async calculateScore(clientId: string, companyId: string) {
    const success = await this.getByClientId(clientId, companyId);
    if (!success) return 0;

    // ── Manual signals (50 pts max) ──────────────────────────────────────────
    let manualScore = 0;

    const completedObjectives = success.objectives.filter((o) => o.completedAt !== null).length;
    if (success.objectives.length > 0) {
      manualScore += (completedObjectives / success.objectives.length) * 20;
    }

    let totalImprovement = 0;
    for (const metric of success.metrics) {
      const cur = Number(metric.currentValue);
      const ini = Number(metric.initialValue);
      if (cur > ini && ini !== 0) totalImprovement += ((cur - ini) / ini) * 100;
    }
    if (success.metrics.length > 0) {
      manualScore += Math.min((totalImprovement / success.metrics.length) * 0.15, 15);
    }

    // Recommendations carry a free-text status; treat both "DONE" and "COMPLETED" as done so
    // scoring is robust to whichever label the UI writes (the rest of the app uses "COMPLETED").
    const doneRecs = success.recommendations.filter(
      (r) => r.status === "DONE" || r.status === "COMPLETED"
    ).length;
    if (success.recommendations.length > 0) {
      manualScore += (doneRecs / success.recommendations.length) * 15;
    }

    // ── Automatic signals from real data (50 pts max) ────────────────────────
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [invoices, client, activeProjects] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          clientId,
          companyId,
          createdAt: { gte: twelveMonthsAgo },
          status: { in: ["SENT", "PARTIAL", "PAID"] },
        },
        select: { amount: true, amountPaid: true, sentAt: true, paidAt: true },
      }),
      prisma.client.findUnique({
        where: { id: clientId },
        select: { createdAt: true },
      }),
      prisma.project.count({
        where: {
          clientId,
          companyId,
          status: { in: ["IN_PROGRESS", "COMPLETED"] },
          updatedAt: { gte: sixMonthsAgo },
        },
      }),
    ]);

    let autoScore = 0;

    // Payment rate (20 pts)
    const totalBilled = invoices.reduce((s, i) => s + Number(i.amount), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
    if (totalBilled > 0) {
      autoScore += (totalPaid / totalBilled) * 20;
    }

    // Average payment delay (15 pts)
    const delays = invoices
      .filter((i) => i.paidAt && i.sentAt)
      .map((i) => (i.paidAt!.getTime() - i.sentAt!.getTime()) / (1000 * 60 * 60 * 24));
    if (delays.length > 0) {
      const avgDays = delays.reduce((s, d) => s + d, 0) / delays.length;
      if (avgDays <= 15) autoScore += 15;
      else if (avgDays <= 30) autoScore += 10;
      else if (avgDays <= 60) autoScore += 5;
    }

    // Active/completed projects in last 6 months (10 pts)
    if (activeProjects >= 1) autoScore += 10;

    // Relationship seniority (5 pts)
    if (client) {
      const ageMonths =
        (Date.now() - client.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (ageMonths >= 12) autoScore += 5;
      else if (ageMonths >= 6) autoScore += 3;
      else autoScore += 1;
    }

    return Math.round(Math.min(manualScore + autoScore, 100));
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
    return clientSuccessRepository.addObjective(success!.id, companyId, data);
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
    const objective = await clientSuccessRepository.updateObjective(id, companyId, data);
    // Completing an objective feeds the manual half of the score; recompute so it isn't stale.
    if (data.completedAt !== undefined) {
      await this.recalcForSuccess(objective.successId, companyId);
    }
    return objective;
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
    const metric = await clientSuccessRepository.addMetric(success!.id, companyId, data);
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
    return clientSuccessRepository.addRecommendation(success!.id, companyId, data);
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
    const recommendation = await clientSuccessRepository.updateRecommendation(id, companyId, data);
    // A completed recommendation feeds the score; recompute on status change.
    if (data.status !== undefined) {
      await this.recalcForSuccess(recommendation.successId, companyId);
    }
    return recommendation;
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
    return clientSuccessRepository.addTimeline(success!.id, companyId, {
      ...data,
      date: data.date || new Date(),
    });
  },

  async deleteTimeline(id: string, companyId: string) {
    return clientSuccessRepository.deleteTimeline(id, companyId);
  },
};
