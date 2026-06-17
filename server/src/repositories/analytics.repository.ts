// Analytics Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import { sqlDateRange } from "../utils/sqlHelpers.js";

export const analyticsRepository = {
  async getLeadStats(companyId: string, from?: Date, to?: Date) {
    const where = {
      companyId,
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [total, byStatusRaw] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.groupBy({
        by: ["status"],
        where,
        _count: { status: true },
      }),
    ]);

    const byStatus = byStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.status,
    }));

    const wonCount = byStatus.find((s) => s.status === "WON")?.count || 0;
    const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    return { total, byStatus, wonCount, conversionRate };
  },

  async getClientStats(companyId: string, from?: Date, to?: Date) {
    const where = {
      companyId,
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthFrom = from && from > startOfMonth ? from : startOfMonth;

    const [total, newThisMonth] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.count({
        where: {
          companyId,
          createdAt: {
            gte: monthFrom,
            ...(to && { lte: to }),
          },
        },
      }),
    ]);

    return { total, newThisMonth };
  },

  async getProjectStats(companyId: string, from?: Date, to?: Date) {
    const where = {
      companyId,
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [total, byStatusRaw] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.groupBy({
        by: ["status"],
        where,
        _count: { status: true },
      }),
    ]);

    const byStatus = byStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.status,
    }));

    const completedCount = byStatus.find((s) => s.status === "COMPLETED")?.count || 0;
    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return { total, byStatus, completedCount, completionRate };
  },

  async getTaskStats(companyId: string, from?: Date, to?: Date) {
    const rows = await prisma.$queryRaw<
      Array<{ total: bigint; doneCount: bigint; overdueCount: bigint }>
    >`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE t.status = 'DONE')::bigint AS "doneCount",
        COUNT(*) FILTER (
          WHERE t."dueDate" < NOW() AND t.status != 'DONE'
        )::bigint AS "overdueCount"
      FROM "Task" t
      INNER JOIN "Project" p ON p.id = t."projectId"
      WHERE p."companyId" = ${companyId}
      ${sqlDateRange("createdAt", from, to, "t")}
    `;

    const row = rows[0];
    return {
      total: Number(row?.total ?? 0),
      doneCount: Number(row?.doneCount ?? 0),
      overdueCount: Number(row?.overdueCount ?? 0),
    };
  },

  async getLeadsByMonth(companyId: string, from?: Date, to?: Date) {
    const rows = await prisma.$queryRaw<
      Array<{ month: string; count: bigint; month_num: number }>
    >`
      SELECT
        TO_CHAR("createdAt", 'Mon') AS month,
        COUNT(*)::bigint AS count,
        EXTRACT(MONTH FROM "createdAt")::int AS month_num
      FROM "Lead"
      WHERE "companyId" = ${companyId}
      ${sqlDateRange("createdAt", from, to)}
      GROUP BY month_num, TO_CHAR("createdAt", 'Mon')
      ORDER BY month_num
    `;

    return rows.map((row) => ({
      month: row.month,
      count: Number(row.count),
    }));
  },

  async getProjectsByStatus(companyId: string, from?: Date, to?: Date) {
    const colorMap: Record<string, string> = {
      PLANNING: "#94a3b8",
      IN_PROGRESS: "#2563eb",
      REVIEW: "#f59e0b",
      COMPLETED: "#10b981",
    };

    const where = {
      companyId,
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const byStatusRaw = await prisma.project.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    });

    return byStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.status,
      color: colorMap[item.status] || "#64748b",
    }));
  },

  async getRevenueByMonth(companyId: string, from?: Date, to?: Date) {
    const rows = await prisma.$queryRaw<
      Array<{ month: string; revenue: number; month_num: number }>
    >`
      SELECT
        TO_CHAR("updatedAt", 'Mon') AS month,
        COALESCE(SUM("budget"), 0)::float AS revenue,
        EXTRACT(MONTH FROM "updatedAt")::int AS month_num
      FROM "FreelancerMission"
      WHERE "companyId" = ${companyId}
        AND status = 'COMPLETED'
      ${sqlDateRange("updatedAt", from, to)}
      GROUP BY month_num, TO_CHAR("updatedAt", 'Mon')
      ORDER BY month_num
    `;

    return rows.map((row) => ({
      month: row.month,
      revenue: Number(row.revenue),
    }));
  },
};
