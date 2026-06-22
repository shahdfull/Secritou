import { clientSuccessRepository } from "../repositories/clientSuccess.repository.js";
import { COMPANY_ID } from "../config/constants.js";
import { prisma } from "../config/prisma.js";

export const clientSuccessService = {
  async getByClientId(clientId: string) {
    let success = await clientSuccessRepository.findByClientId(clientId, COMPANY_ID);
    if (!success) {
      await clientSuccessRepository.create({ clientId, companyId: COMPANY_ID });
      success = await clientSuccessRepository.findByClientId(clientId, COMPANY_ID);
    }
    return success!
  },

  async updateScore(clientId: string, score: number) {
    const success = await this.getByClientId(clientId);
    return clientSuccessRepository.update(success!.id, COMPANY_ID, { score });
  },

  /**
   * Recompute and persist a client's success score. Called automatically when the underlying
   * data changes (a payment is recorded, an objective/recommendation is completed) so the
   * displayed score isn't stale until the nightly batch runs. Best-effort: never throws into
   * the caller's flow, since scoring is a side effect of the primary action.
   */
  async recalcAndPersist(clientId: string) {
    try {
      const score = await this.calculateScore(clientId);
      await this.updateScore(clientId, score);
    } catch {
      // Non-fatal: a scoring failure must not break the payment/objective update that triggered it.
    }
  },

  /** Resolve the clientId behind a ClientSuccess id and recompute its score (best-effort). */
  async recalcForSuccess(successId: string) {
    try {
      const success = await prisma.clientSuccess.findFirst({
        where: { id: successId, client: { companyId: COMPANY_ID } },
        select: { clientId: true },
      });
      if (success) await this.recalcAndPersist(success.clientId);
    } catch {
      // Non-fatal.
    }
  },

  async calculateScore(clientId: string) {
    const success = await this.getByClientId(clientId);
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
          companyId: COMPANY_ID,
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
          companyId: COMPANY_ID,
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
    data: {
      title: string;
      description?: string;
      targetValue?: number;
      currentValue?: number;
      unit?: string;
      targetDate?: Date;
    }
  ) {
    const success = await this.getByClientId(clientId);
    return clientSuccessRepository.addObjective(success!.id, COMPANY_ID, data);
  },

  async updateObjective(
    id: string,
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
    const objective = await clientSuccessRepository.updateObjective(id, COMPANY_ID, data);
    // Completing an objective feeds the manual half of the score; recompute so it isn't stale.
    if (data.completedAt !== undefined) {
      await this.recalcForSuccess(objective.successId);
    }
    return objective;
  },

  async deleteObjective(id: string) {
    return clientSuccessRepository.deleteObjective(id, COMPANY_ID);
  },

  async addMetric(
    clientId: string,
    data: {
      name: string;
      initialValue: number;
      currentValue: number;
      unit?: string;
    }
  ) {
    const success = await this.getByClientId(clientId);
    const metric = await clientSuccessRepository.addMetric(success!.id, COMPANY_ID, data);
    await clientSuccessRepository.addMetricHistory(metric.id, COMPANY_ID, {
      value: data.currentValue,
    });
    return metric;
  },

  async updateMetric(
    id: string,
    data: Partial<{
      name: string;
      initialValue: number;
      currentValue: number;
      unit: string;
    }>
  ) {
    const metric = await clientSuccessRepository.updateMetric(id, COMPANY_ID, data);
    if (data.currentValue !== undefined) {
      await clientSuccessRepository.addMetricHistory(id, COMPANY_ID, { value: data.currentValue });
    }
    return metric;
  },

  async deleteMetric(id: string) {
    return clientSuccessRepository.deleteMetric(id, COMPANY_ID);
  },

  async addRecommendation(
    clientId: string,
    data: {
      title: string;
      description?: string;
      priority?: number;
      status?: string;
    }
  ) {
    const success = await this.getByClientId(clientId);
    return clientSuccessRepository.addRecommendation(success!.id, COMPANY_ID, data);
  },

  async updateRecommendation(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      priority: number;
      status: string;
    }>
  ) {
    const recommendation = await clientSuccessRepository.updateRecommendation(id, COMPANY_ID, data);
    // A completed recommendation feeds the score; recompute on status change.
    if (data.status !== undefined) {
      await this.recalcForSuccess(recommendation.successId);
    }
    return recommendation;
  },

  async deleteRecommendation(id: string) {
    return clientSuccessRepository.deleteRecommendation(id, COMPANY_ID);
  },

  async addTimeline(
    clientId: string,
    data: {
      title: string;
      description?: string;
      eventType: string;
      date?: Date;
    }
  ) {
    const success = await this.getByClientId(clientId);
    return clientSuccessRepository.addTimeline(success!.id, COMPANY_ID, {
      ...data,
      date: data.date || new Date(),
    });
  },

  async deleteTimeline(id: string) {
    return clientSuccessRepository.deleteTimeline(id, COMPANY_ID);
  },
};
