import { summaryRepository } from "../repositories/summary.repository.js";
import { prismaRead } from "../config/prisma.js";
import { cacheGet, cacheSet, cacheTTL } from "../cache/cacheService.js";
import { cacheKeys, cacheTags } from "../cache/cacheKeys.js";
import { businessDashboardSummaryRecalculated } from "../observability/businessMetrics.js";
import { analyticsService } from "./analytics.service.js";

export const dashboardService = {
  async getFullDashboard(serviceId?: string | null) {
    const approvalWhere = serviceId !== undefined
      ? { status: "PENDING" as const, project: { serviceId: serviceId ?? "__none__" } }
      : { status: "PENDING" as const };
    const invoiceStatuses = ["SENT", "PARTIAL", "OVERDUE"] as ("SENT" | "PARTIAL" | "OVERDUE")[];
    // Same scope rule as invoiceRepository.findAllByServiceId: project-less
    // invoices are service-neutral and count for every manager.
    const invoiceWhere = serviceId !== undefined
      ? { status: { in: invoiceStatuses }, dueDate: { lt: new Date() }, OR: [{ project: { serviceId: serviceId ?? "__none__" } }, { projectId: null }] }
      : { status: { in: invoiceStatuses }, dueDate: { lt: new Date() } };
    const leadWhere = serviceId !== undefined
      ? { status: "QUALIFIED" as const, archivedAt: null, serviceId: serviceId ?? "__none__" }
      : { status: "QUALIFIED" as const, archivedAt: null };

    const [summary, pendingApprovals, overdueInvoices, hotLeads] = await Promise.all([
      this.getSummary(serviceId),
      prismaRead.approval.count({ where: approvalWhere }),
      // Computed at read time so the dashboard is correct even between the daily overdue job runs.
      prismaRead.invoice.count({ where: invoiceWhere }),
      prismaRead.lead.count({ where: leadWhere }),
    ]);

    return {
      ...summary,
      totalLeads: Object.values(summary.leads as Record<string, number>).reduce((a, b) => a + b, 0),
      activeClients: (summary.clients as { total: number }).total,
      ongoingProjects: (summary.projects as Record<string, number>)["IN_PROGRESS"] ?? 0,
      completedTasks: (summary.tasks as Record<string, number>)["DONE"] ?? 0,
      pendingApprovalsCount: pendingApprovals,
      overdueInvoicesCount: overdueInvoices,
      hotLeadsCount: hotLeads,
    };
  },

  async getSummary(serviceId?: string | null) {
    const cacheKey = cacheKeys.dashboardSummary(serviceId);
    const cached = await cacheGet<Awaited<ReturnType<typeof summaryRepository.getEnhancedDashboardSummary>>>(cacheKey);
    if (cached) return cached;

    const summary = serviceId !== undefined
      ? await analyticsService.getSummary(undefined, undefined, serviceId)
      : await summaryRepository.getEnhancedDashboardSummary();
    await cacheSet(cacheKey, summary, cacheTTL.dashboard, [cacheTags.dashboard(), cacheTags.company()]);
    return summary;
  },

  async warmSummary() {
    const summary = await summaryRepository.getEnhancedDashboardSummary();
    await cacheSet(cacheKeys.dashboardSummary(), summary, cacheTTL.dashboard, [cacheTags.dashboard(), cacheTags.company()]);
    businessDashboardSummaryRecalculated.inc({ company: "secritou" });
    return summary;
  },

  async warmAllSummaries() {
    await this.warmSummary();
    return 1;
  },
};
