import { prismaRead } from "../config/prisma.js";

export type ClientHealthStatus = "champion" | "good" | "at-risk" | "lost";

export interface ClientProfitabilityItem {
  clientId: string;
  clientName: string;
  totalRevenue: number;
  pendingRevenue: number;
  totalProjects: number;
  completedProjects: number;
  totalTaskMinutes: number;
  avgProjectDurationDays: number;
  lastProjectCompletedAt: Date | null;
  healthStatus: ClientHealthStatus;
}

const SIX_MONTHS_MS = 6 * 30 * 86_400_000;

export const clientProfitabilityRepository = {
  async getProfitability(): Promise<ClientProfitabilityItem[]> {
    const now = new Date();

    const clients = await prismaRead.client.findMany({
      select: {
        id: true,
        name: true,
        projects: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            clientApprovedAt: true,
            tasks: { select: { id: true } },
          },
        },
        invoices: {
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

      // Time tracking — summed from TimeEntry if model exists (graceful fallback to 0)
      const totalTaskMinutes = 0; // Will be enriched when time tracking is live

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
