import { prismaRead as prisma } from "../config/prisma.js";
import { getProgressByProjectIds } from "../utils/projectProgress.js";

export const summaryRepository = {
  async getClientSummary(clientId: string) {
    const [client, projects, tasks, invoices, serviceRequests, documents] = await Promise.all([
      prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      }),
      prisma.project.findMany({
        where: { clientId },
        select: { id: true, name: true, status: true, createdAt: true, tasks: { select: { id: true, status: true } } },
      }),
      prisma.task.count({ where: { project: { clientId } } }),
      // Confirmed invoiced amount for this client (excludes unconfirmed DRAFT / voided
      // CANCELLED invoices). totalPaid here is cash recorded against those invoices.
      prisma.invoice.aggregate({
        where: { clientId, status: { notIn: ["DRAFT", "CANCELLED"] } },
        _sum: { amount: true, amountPaid: true },
        _count: true,
      }),
      prisma.serviceRequest.count({ where: { clientId } }),
      prisma.document.count({ where: { clientId } }),
    ]);

    if (!client) return null;

    const projectIds = projects.map((p) => p.id);
    const progressMap = await getProgressByProjectIds(projectIds);

    const projectSummaries = projects.map((project: any) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      progress: progressMap.get(project.id) ?? 0,
      taskCount: project.tasks.length,
      createdAt: project.createdAt,
    }));

    return {
      client,
      projects: projectSummaries,
      taskCount: tasks,
      invoiceCount: invoices._count,
      totalInvoiced: invoices._sum.amount?.toNumber() ?? 0,
      totalPaid: invoices._sum.amountPaid?.toNumber() ?? 0,
      serviceRequestCount: serviceRequests,
      documentCount: documents,
    };
  },

  async getProjectSummary(projectId: string) {
    const [project, tasks, documents, invoices, comments] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          createdAt: true,
          clientId: true,
          client: { select: { id: true, name: true } },
        },
      }),
      prisma.task.groupBy({ by: ["status"], where: { projectId }, _count: { id: true } }),
      prisma.document.count({ where: { projectId } }),
      prisma.invoice.count({ where: { projectId } }),
      prisma.comment.count({ where: { task: { projectId } } }),
    ]);

    if (!project) return null;

    const taskCounts: Record<string, number> = {};
    tasks.forEach((t: any) => { taskCounts[t.status] = t._count.id; });

    return { project, taskCounts, documentCount: documents, invoiceCount: invoices, commentCount: comments };
  },

  async getEnhancedDashboardSummary() {
    const [
      leadCounts,
      clientCounts,
      projectCounts,
      taskCounts,
      recentProjects,
      recentLeads,
      recentTasks,
      invoiceMetrics,
    ] = await Promise.all([
      prisma.lead.groupBy({ by: ["status"], where: { archivedAt: null }, _count: true }),
      prisma.client.count({}),
      prisma.project.groupBy({ by: ["status"], _count: true }),
      prisma.task.groupBy({ by: ["status"], _count: true }),
      prisma.project.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, status: true, createdAt: true, client: { select: { id: true, name: true } } },
      }),
      prisma.lead.findMany({
        where: { archivedAt: null },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, status: true, createdAt: true },
      }),
      prisma.task.findMany({
        take: 10,
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, status: true, updatedAt: true, project: { select: { id: true, name: true } } },
      }),
      // "Invoiced (confirmed)": DRAFT and CANCELLED excluded — not committed billing.
      // NOTE: this is *invoiced* (billed), NOT *collected* cash. Collected cash lives in
      // analytics.repository.getRevenueByMonth (keyed on real payment dates).
      prisma.invoice.aggregate({
        where: { status: { notIn: ["DRAFT", "CANCELLED"] } },
        _sum: { amount: true, amountPaid: true },
        _count: true,
      }),
    ]);

    const leadStatusCounts: Record<string, number> = {};
    leadCounts.forEach((c) => (leadStatusCounts[c.status] = c._count));

    const projectStatusCounts: Record<string, number> = {};
    projectCounts.forEach((c) => (projectStatusCounts[c.status] = c._count));

    const taskStatusCounts: Record<string, number> = {};
    taskCounts.forEach((c) => (taskStatusCounts[c.status] = c._count));

    return {
      leads: leadStatusCounts,
      clients: { total: clientCounts },
      projects: projectStatusCounts,
      tasks: taskStatusCounts,
      recentProjects,
      recentLeads,
      recentTasks,
      invoices: {
        total: invoiceMetrics._count,
        totalAmount: invoiceMetrics._sum.amount?.toNumber() ?? 0,
        totalPaid: invoiceMetrics._sum.amountPaid?.toNumber() ?? 0,
      },
    };
  },
};
