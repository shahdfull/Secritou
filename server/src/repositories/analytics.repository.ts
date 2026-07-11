// Analytics Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import { startOfBusinessMonth, businessMonthKey, fillMonthGaps } from "../utils/dateRange.js";

function getPreviousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const duration = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - duration), to: new Date(to.getTime() - duration) };
}

function serviceFilter(serviceId?: string | null) {
  return serviceId !== undefined ? { serviceId: serviceId ?? "__none__" } : {};
}

export const analyticsRepository = {
  async getLeadStats(from?: Date, to?: Date, serviceId?: string | null) {
    const where = {
      ...serviceFilter(serviceId),
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    };

    const [total, byStatusRaw] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.groupBy({ by: ["status"], where, _count: { status: true }, orderBy: { status: "asc" } }),
    ]);

    const byStatus = byStatusRaw.map((item) => ({ status: item.status, count: item._count.status }));
    const wonCount = byStatus.find((s) => s.status === "WON")?.count || 0;
    const leadConversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    let previousLeadConversionRate = 0;
    if (from && to) {
      const previous = getPreviousPeriod(from, to);
      const previousWhere = { createdAt: { gte: previous.from, lte: previous.to } };
      const [prevTotal, prevByStatusRaw] = await Promise.all([
        prisma.lead.count({ where: previousWhere }),
        prisma.lead.groupBy({ by: ["status"], where: previousWhere, _count: { status: true }, orderBy: { status: "asc" } }),
      ]);
      const prevWonCount = prevByStatusRaw.find((s) => s.status === "WON")?._count?.status || 0;
      previousLeadConversionRate = prevTotal > 0 ? Math.round((prevWonCount / prevTotal) * 100) : 0;
    }

    return { total, byStatus, wonCount, leadConversionRate, previousLeadConversionRate };
  },

  async getClientStats(from?: Date, to?: Date, serviceId?: string | null) {
    const sf = serviceFilter(serviceId);
    const clientServiceFilter = serviceId !== undefined
      ? { projects: { some: { serviceId: serviceId ?? "__none__" } } }
      : {};
    const where = {
      ...clientServiceFilter,
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    };
    const startOfMonth = startOfBusinessMonth();
    const monthFrom = from && from > startOfMonth ? from : startOfMonth;

    const [total, newThisMonth] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.count({ where: { ...clientServiceFilter, createdAt: { gte: monthFrom, ...(to && { lte: to }) } } }),
    ]);

    let previousNew = 0;
    if (from && to) {
      const previous = getPreviousPeriod(from, to);
      previousNew = await prisma.client.count({ where: { ...clientServiceFilter, createdAt: { gte: previous.from, lte: previous.to } } });
    }

    return { total, newThisMonth, previousNew };
  },

  async getProjectStats(from?: Date, to?: Date, serviceId?: string | null) {
    const where = {
      ...serviceFilter(serviceId),
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    };

    const [total, byStatusRaw] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.groupBy({ by: ["status"], where, _count: { status: true }, orderBy: { status: "asc" } }),
    ]);

    const byStatus = byStatusRaw.map((item) => ({ status: item.status, count: item._count.status }));
    const completedCount = byStatus.find((s) => s.status === "COMPLETED")?.count || 0;
    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    let previousCompletionRate = 0;
    if (from && to) {
      const previous = getPreviousPeriod(from, to);
      const previousWhere = { createdAt: { gte: previous.from, lte: previous.to } };
      const [prevTotal, prevByStatusRaw] = await Promise.all([
        prisma.project.count({ where: previousWhere }),
        prisma.project.groupBy({ by: ["status"], where: previousWhere, _count: { status: true }, orderBy: { status: "asc" } }),
      ]);
      const prevCompletedCount = prevByStatusRaw.find((s) => s.status === "COMPLETED")?._count?.status || 0;
      previousCompletionRate = prevTotal > 0 ? Math.round((prevCompletedCount / prevTotal) * 100) : 0;
    }

    return { total, byStatus, completedCount, completionRate, previousCompletionRate };
  },

  async getTaskStats(from?: Date, to?: Date, serviceId?: string | null) {
    const projectWhere = serviceId !== undefined ? { serviceId: serviceId ?? "__none__" } : {};
    const taskWhere = {
      project: { ...projectWhere },
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    };

    const [total, doneCount, overdueCount] = await Promise.all([
      prisma.task.count({ where: taskWhere }),
      prisma.task.count({ where: { ...taskWhere, status: "DONE" } }),
      prisma.task.count({ where: { ...taskWhere, dueDate: { lt: new Date() }, status: { not: "DONE" } } }),
    ]);

    const taskDonePct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    let previousTaskDonePct = 0;
    if (from && to) {
      const previous = getPreviousPeriod(from, to);
      const prevWhere = { project: { ...projectWhere }, createdAt: { gte: previous.from, lte: previous.to } };
      const [prevTotal, prevDone] = await Promise.all([
        prisma.task.count({ where: prevWhere }),
        prisma.task.count({ where: { ...prevWhere, status: "DONE" } }),
      ]);
      previousTaskDonePct = prevTotal > 0 ? Math.round((prevDone / prevTotal) * 100) : 0;
    }

    return { total, doneCount, overdueCount, taskDonePct, previousTaskDonePct };
  },

  async getLeadsByMonth(from?: Date, to?: Date, serviceId?: string | null) {
    const rangeFrom = from ?? startOfBusinessMonth(new Date(new Date().setMonth(new Date().getMonth() - 11)));
    const rangeTo = to ?? new Date();
    const where = {
      ...serviceFilter(serviceId),
      createdAt: { gte: rangeFrom, lte: rangeTo },
    };
    // groupBy(createdAt) would group by the exact timestamp (effectively one row per
    // lead) since createdAt has second-level precision — fetch and bucket in JS instead.
    const rows = await prisma.lead.findMany({ where, select: { createdAt: true } });

    const byMonth = new Map<string, number>();
    for (const row of rows) {
      const key = businessMonthKey(row.createdAt);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    return fillMonthGaps(byMonth, rangeFrom, rangeTo, 0).map(({ month, value }) => ({ month, count: value }));
  },

  async getProjectsByStatus(from?: Date, to?: Date, serviceId?: string | null) {
    const colorMap: Record<string, string> = {
      PLANNING: "#94a3b8",
      IN_PROGRESS: "#2563eb",
      REVIEW: "#f59e0b",
      COMPLETED: "#10b981",
    };
    const where = {
      ...serviceFilter(serviceId),
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    };
    const byStatusRaw = await prisma.project.groupBy({ by: ["status"], where, _count: { status: true }, orderBy: { status: "asc" } });
    return byStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.status,
      color: colorMap[item.status] || "#64748b",
    }));
  },

  // "Revenue" here means cash actually collected (Payment.paidAt), as distinct from
  // invoiced/billed amounts — see executiveMetrics.repository.ts's cash-vs-billed split,
  // which this should stay consistent with in wording wherever it's surfaced.
  async getRevenueByMonth(from?: Date, to?: Date, serviceId?: string | null) {
    const rangeFrom = from ?? startOfBusinessMonth(new Date(new Date().setMonth(new Date().getMonth() - 11)));
    const rangeTo = to ?? new Date();
    const invoiceWhere = serviceId !== undefined
      ? { status: { not: "CANCELLED" as const }, project: { serviceId: serviceId ?? "__none__" } }
      : { status: { not: "CANCELLED" as const } };
    const payments = await prisma.payment.findMany({
      where: {
        paidAt: { not: null, gte: rangeFrom, lte: rangeTo },
        invoice: invoiceWhere,
      },
      select: { paidAt: true, amount: true },
    });

    const byMonth = new Map<string, number>();
    for (const p of payments) {
      if (!p.paidAt || p.amount == null) continue;
      const key = businessMonthKey(p.paidAt);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(p.amount));
    }
    return fillMonthGaps(byMonth, rangeFrom, rangeTo, 0).map(({ month, value }) => ({ month, revenue: value }));
  },
};
