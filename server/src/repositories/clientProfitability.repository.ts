import { prismaRead } from "../config/prisma.js";
import { roundMoney } from "../utils/vat.js";

export type ClientHealthStatus = "champion" | "good" | "at-risk" | "lost";

export interface ClientProfitabilityItem {
  clientId: string;
  clientName: string;
  // CA encaissé (sum of PAID invoices) — not a margin. Do not treat this as "profitability"
  // without also looking at totalCost: it does not net out any cost.
  totalRevenue: number;
  pendingRevenue: number;
  // Freelancer time cost (TimeEntry.minutes x freelancerProfile.hourlyRate), summed across
  // the client's projects. Entries from users without an hourlyRate contribute 0 cost —
  // this is NOT a full cost model (no ADMIN/MANAGER time, no overhead), so totalRevenue
  // minus totalCost is deliberately not exposed as a combined "margin" figure here.
  totalCost: number;
  totalProjects: number;
  completedProjects: number;
  totalTaskMinutes: number;
  avgProjectDurationDays: number;
  lastProjectCompletedAt: Date | null;
  healthStatus: ClientHealthStatus;
}

const SIX_MONTHS_MS = 6 * 30 * 86_400_000;

export const clientProfitabilityRepository = {
  async getProfitability(serviceId?: string): Promise<ClientProfitabilityItem[]> {
    const now = new Date();

    const clients = await prismaRead.client.findMany({
      where: { deletedAt: null, ...(serviceId ? { projects: { some: { serviceId } } } : {}) },
      select: {
        id: true,
        name: true,
        projects: {
          where: { deletedAt: null, ...(serviceId ? { serviceId } : {}) },
          select: {
            id: true,
            status: true,
            createdAt: true,
            clientApprovedAt: true,
            tasks: { select: { id: true } },
            timeEntries: {
              select: { minutes: true, user: { select: { freelancerProfile: { select: { hourlyRate: true } } } } },
            },
          },
        },
        invoices: {
          where: { deletedAt: null, ...(serviceId ? { OR: [{ project: { serviceId } }, { projectId: null }] } : {}) },
          select: { status: true, amount: true, dueDate: true, createdAt: true },
        },
      },
    });

    const items: ClientProfitabilityItem[] = clients.map((c) => {
      const paidInvoices = c.invoices.filter((i) => i.status === "PAID");
      const pendingInvoices = c.invoices.filter((i) => ["SENT", "PARTIAL"].includes(i.status));

      const totalRevenue = paidInvoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
      const pendingRevenue = pendingInvoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);

      const totalProjects = c.projects.length;
      const completedProjects = c.projects.filter((p) => p.status === "COMPLETED");
      const completedCount = completedProjects.length;

      // Duration: createdAt → clientApprovedAt for completed ones
      const durationsMs = completedProjects
        .filter((p) => p.clientApprovedAt !== null)
        .map((p) => p.clientApprovedAt!.getTime() - p.createdAt.getTime());
      const avgProjectDurationDays =
        durationsMs.length > 0
          ? Math.round(durationsMs.reduce((s, d) => s + d, 0) / durationsMs.length / 86_400_000)
          : 0;

      const lastCompleted = completedProjects
        .filter((p) => p.clientApprovedAt !== null)
        .reduce<Date | null>((latest, p) => {
          if (!latest || p.clientApprovedAt! > latest) return p.clientApprovedAt!;
          return latest;
        }, null);

      const allTimeEntries = c.projects.flatMap((p) => p.timeEntries);
      const totalTaskMinutes = allTimeEntries.reduce((s, e) => s + e.minutes, 0);
      // Entries from users without an hourlyRate contribute 0 — see totalCost's doc comment.
      const totalCost = roundMoney(
        allTimeEntries.reduce((s, e) => {
          const rate = e.user.freelancerProfile?.hourlyRate ? Number(e.user.freelancerProfile.hourlyRate) : 0;
          return s + (e.minutes / 60) * rate;
        }, 0)
      );

      // Health status logic
      const overdueInvoices = c.invoices.filter(
        (i) => ["SENT", "PARTIAL"].includes(i.status) && i.dueDate && i.dueDate < now
      );
      const hasActiveProject = c.projects.some((p) => p.status !== "COMPLETED");
      const lastActivityTooOld =
        lastCompleted !== null && now.getTime() - lastCompleted.getTime() > SIX_MONTHS_MS;

      let healthStatus: ClientHealthStatus;
      if (overdueInvoices.some((i) => i.dueDate && now.getTime() - i.dueDate.getTime() > 30 * 86_400_000)) {
        healthStatus = "at-risk";
      } else if (!hasActiveProject && lastActivityTooOld) {
        healthStatus = "lost";
      } else if (completedCount >= 2) {
        healthStatus = "champion";
      } else {
        healthStatus = "good";
      }

      return {
        clientId: c.id,
        clientName: c.name,
        totalRevenue,
        pendingRevenue,
        totalCost,
        totalProjects,
        completedProjects: completedCount,
        totalTaskMinutes,
        avgProjectDurationDays,
        lastProjectCompletedAt: lastCompleted,
        healthStatus,
      };
    });

    items.sort((a, b) => b.totalRevenue - a.totalRevenue);
    return items;
  },
};
