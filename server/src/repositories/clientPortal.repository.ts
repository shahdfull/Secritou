import { prismaRead } from "../config/prisma.js";

export const clientPortalRepository = {
  async getOutstandingBalance(clientId: string) {
    const agg = await prismaRead.invoice.aggregate({
      where: { clientId, deletedAt: null, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      _sum: { amount: true, amountPaid: true },
    });
    const amount = Number(agg._sum.amount ?? 0);
    const amountPaid = Number(agg._sum.amountPaid ?? 0);
    return Math.max(amount - amountPaid, 0);
  },

  async getNextDueInvoice(clientId: string) {
    return prismaRead.invoice.findFirst({
      where: { clientId, deletedAt: null, status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      select: { id: true, number: true, dueDate: true, amount: true, amountPaid: true, currency: true },
    });
  },

  async getCurrentProjectProgress(clientId: string) {
    const project = await prismaRead.project.findFirst({
      where: { clientId, archivedAt: null, status: { notIn: ["COMPLETED"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        tasks: { select: { status: true } },
      },
    });
    if (!project) return null;

    const totalTasks = project.tasks.length;
    const openTasksCount = project.tasks.filter((t) => t.status !== "DONE").length;
    const progress = totalTasks > 0 ? Math.round(((totalTasks - openTasksCount) / totalTasks) * 100) : 0;

    return { projectId: project.id, projectName: project.name, progress };
  },
};
