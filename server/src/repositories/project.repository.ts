// Project Repository - Data access layer
import { prismaRead as prisma } from "../config/prisma.js";
import type { Project, ProjectStatus, Role } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildOrderBy, buildTextSearchFilter } from "../utils/listQuery.js";
import { getProgressByProjectIds, getProgressForProject } from "../utils/projectProgress.js";
import { clientBriefSelect } from "../utils/prismaSelects.js";

type ProjectWithProgress = Project & {
  client?: { id: string; name: string; email: string | null; phone: string | null } | null;
  progress: number;
};

const SORTABLE_FIELDS = ["name", "status", "createdAt"];

function buildWhere(userId: string, userRole: Role, options: ListQueryOptions, clientId?: string) {
  const searchFilter = buildTextSearchFilter(options.search, ["name", "description"]);
  const statusFilter = options.status ? { status: options.status as ProjectStatus } : {};
  const base = { archivedAt: null, ...statusFilter, ...searchFilter };

  if (userRole === "ADMIN" || userRole === "MANAGER") return base;
  if (userRole === "FREELANCER") return { tasks: { some: { assigneeId: userId } }, ...base };
  return { clientId, ...base };
}

const projectListSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  clientId: true,
  serviceId: true,
  proposalId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  budget: true,
  deadline: true,
  serviceType: true,
  briefData: true,
  briefCompleted: true,
  briefCompletedAt: true,
  clientApprovedAt: true,
  clientApprovedById: true,
  client: { select: clientBriefSelect },
} as const;

export const projectRepository = {
  async findAll(
    userId: string,
    userRole: Role,
    options: ListQueryOptions,
    clientId?: string
  ): Promise<PaginatedResult<ProjectWithProgress>> {
    const where = buildWhere(userId, userRole, options, clientId);
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, "createdAt");

    const [projects, total] = await Promise.all([
      prisma.project.findMany({ where, select: projectListSelect, orderBy, skip, take: options.pageSize }),
      prisma.project.count({ where }),
    ]);

    const progressMap = await getProgressByProjectIds(projects.map((p) => p.id));
    const data = projects.map((project) => ({
      ...project,
      progress: progressMap.get(project.id) ?? 0,
    }));

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(
    id: string,
    userId: string,
    userRole: Role,
    clientId?: string
  ): Promise<ProjectWithProgress | null> {
    const baseSelect = { ...projectListSelect, client: { select: clientBriefSelect } };
    let project: (Project & { client?: ProjectWithProgress["client"] }) | null;

    if (userRole === "ADMIN" || userRole === "MANAGER") {
      project = await prisma.project.findUnique({ where: { id }, select: baseSelect });
    } else if (userRole === "FREELANCER") {
      project = await prisma.project.findFirst({
        where: { id, tasks: { some: { assigneeId: userId } } },
        select: baseSelect,
      });
    } else {
      project = await prisma.project.findUnique({ where: { id, clientId }, select: baseSelect });
    }

    if (!project) return null;
    return { ...project, progress: await getProgressForProject(project.id) };
  },

  async findByIdAdmin(id: string) {
    return prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, clientId: true, serviceId: true },
    });
  },

  async create(data: {
    name: string;
    description?: string;
    status?: ProjectStatus;
    clientId?: string;
    serviceId?: string;
  }): Promise<Project> {
    return prisma.project.create({
      data,
      include: { client: { select: clientBriefSelect } },
    });
  },

  async update(id: string, data: Partial<{
    name?: string;
    description?: string;
    status?: ProjectStatus;
    clientId?: string;
    serviceId?: string;
  }>): Promise<Project> {
    return prisma.project.update({
      where: { id },
      data,
      include: { client: { select: clientBriefSelect } },
    });
  },

  async delete(id: string): Promise<Project> {
    return prisma.project.delete({ where: { id } });
  },

  async archive(id: string): Promise<Project> {
    return prisma.project.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: { client: { select: clientBriefSelect } },
    });
  },

  async countNonDraftInvoices(id: string): Promise<number> {
    return prisma.invoice.count({ where: { projectId: id, status: { not: "DRAFT" } } });
  },

  async countOnboardings(id: string): Promise<number> {
    return prisma.clientOnboarding.count({ where: { projectId: id } });
  },
};
