// Analytics Repository - Data access layer
import { prisma } from "../config/prisma.js";

export const analyticsRepository = {
  async getLeadStats(companyId: string) {
    const total = await prisma.lead.count({ where: { companyId } });

    const byStatusRaw = await prisma.lead.groupBy({
      by: ["status"],
      where: { companyId },
      _count: {
        status: true,
      },
    });

    const byStatus = byStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.status,
    }));

    const wonCount = byStatus.find((s) => s.status === "WON")?.count || 0;
    const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    return { total, byStatus, wonCount, conversionRate };
  },

  async getClientStats(companyId: string) {
    const total = await prisma.client.count({ where: { companyId } });

    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    const newThisMonth = await prisma.client.count({
      where: { companyId, createdAt: { gte: startOfMonth } },
    });

    return { total, newThisMonth };
  },

  async getProjectStats(companyId: string) {
    const total = await prisma.project.count({ where: { companyId } });

    const byStatusRaw = await prisma.project.groupBy({
      by: ["status"],
      where: { companyId },
      _count: {
        status: true,
      },
    });

    const byStatus = byStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.status,
    }));

    const completedCount = byStatus.find((s) => s.status === "COMPLETED")?.count || 0;
    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return { total, byStatus, completedCount, completionRate };
  },

  async getTaskStats(companyId: string) {
    const total = await prisma.task.count({ where: { project: { companyId } } });
    const doneCount = await prisma.task.count({
      where: { project: { companyId }, status: "DONE" },
    });

    const now = new Date();
    const overdueCount = await prisma.task.count({
      where: {
        project: { companyId },
        dueDate: { lt: now },
        NOT: { status: "DONE" },
      },
    });

    return { total, doneCount, overdueCount };
  },

  async getLeadsByMonth(companyId: string) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const leads = await prisma.lead.findMany({
      where: { companyId, createdAt: { gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) } },
    });

    const byMonth = leads.reduce((acc, lead) => {
      const monthName = months[lead.createdAt.getMonth()];
      const existing = acc.find((m) => m.month === monthName);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ month: monthName, count: 1 });
      }
      return acc;
    }, [] as { month: string; count: number }[]);

    return byMonth;
  },

  async getProjectsByStatus(companyId: string) {
    const colorMap: Record<string, string> = {
      PLANNING: "#94a3b8",
      IN_PROGRESS: "#2563eb",
      REVIEW: "#f59e0b",
      COMPLETED: "#10b981",
    };

    const byStatusRaw = await prisma.project.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { status: true },
    });

    return byStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.status,
      color: colorMap[item.status] || "#64748b",
    }));
  },
};
