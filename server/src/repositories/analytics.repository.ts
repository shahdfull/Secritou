// Analytics Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import { startOfBusinessMonth } from "../utils/dateRange.js";

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
      prisma.lead.groupBy({ by: ["status"], where, _count: { status: true } }),
    ]);

    const byStatus = byStatusRaw.map((item) => ({ status: item.status, count: item._count.status }));
    const wonCount = byStatus.find((s) => s.status === "WON")?.count || 0;
    const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    let previousConversionRate = 0;
    if (from && to) {
      const previous = getPreviousPeriod(from, to);
      const previousWhere = { createdAt: { gte: previous.from, lte: previous.to } };
      const [prevTotal, prevByStatusRaw] = await Promise.all([
        prisma.lead.count({ where: previousWhere }),
        prisma.lead.groupBy({ by: ["status"], where: previousWhere, _count: { status: true } }),
      ]);
      const prevWonCount = prevByStatusRaw.find((s) => s.status === "WON")?._count?.status || 0;
      previousConversionRate = prevTotal > 0 ? Math.round((prevWonCount / prevTotal) * 100) : 0;
    }

    return { total, byStatus, wonCount, conversionRate, previousConversionRate };
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
      prisma.project.groupBy({ by: ["status"], where, _count: { status: true } }),
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
        prisma.project.groupBy({ by: ["status"], where: previousWhere, _count: { status: true } }),
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
    const where = {
      ...serviceFilter(serviceId),
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    };
    const rows = await prisma.lead.groupBy({
      by: ["createdAt"],
      where,
      _count: { id: true },
      orderBy: { createdAt: "asc" },
    });
    const byMonth = new Map<string, number>();
    for (const row of rows) {
      const month = new Date(row.createdAt).toLocaleString("en-US", { month: "short" });
      byMonth.set(month, (byMonth.get(month) ?? 0) + row._count.id);
    }
    return Array.from(byMonth.entries()).map(([month, count]) => ({ month, count }));
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
    const byStatusRaw = await prisma.project.groupBy({ by: ["status"], where, _count: { status: true } });
    return byStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.status,
      color: colorMap[item.status] || "#64748b",
    }));
  },

  async getRevenueByMonth(from?: Date, to?: Date, serviceId?: string | null) {
    const invoiceWhere = serviceId !== undefined
      ? { status: { not: "CANCELLED" as const }, project: { serviceId: serviceId ?? "__none__" } }
      : { status: { not: "CANCELLED" as const } };
    const payments = await prisma.payment.findMany({
      where: {
        paidAt: { not: null, ...(from && { gte: from }), ...(to && { lte: to }) },
        invoice: invoiceWhere,
      },
      select: { paidAt: true, amount: true },
    });

    const byMonth = new Map<string, number>();
    for (const p of payments) {
      if (!p.paidAt || p.amount == null) continue;
      const label = new Date(p.paidAt).toLocaleString("en-US", { month: "short", year: "numeric" });
      byMonth.set(label, (byMonth.get(label) ?? 0) + Number(p.amount));
    }
    return Array.from(byMonth.entries()).map(([month, revenue]) => ({ month, revenue }));
  },
};
