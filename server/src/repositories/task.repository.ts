// Task Repository - Data access layer
import { prisma } from "../config/prisma.js";
import type { TaskStatus, Role, Prisma } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildTextSearchFilter } from "../utils/listQuery.js";
import { taskWithRelationsSelect } from "../utils/prismaSelects.js";
import { HttpError } from "../utils/httpError.js";

const SORTABLE_FIELDS = ["title", "status", "dueDate", "createdAt"];

type TaskWithRelations = Prisma.TaskGetPayload<{ select: typeof taskWithRelationsSelect }>;

function buildWhere(companyId: string, userId: string, userRole: Role, options: ListQueryOptions, projectId?: string) {
  const base = {
    project: { companyId },
    ...(projectId && { projectId }),
    ...(options.status ? { status: options.status as TaskStatus } : {}),
    ...buildTextSearchFilter(options.search, ["title", "description"]),
  };
  if (userRole === "FREELANCER") {
    return { ...base, assigneeId: userId };
  }
  return base;
}

function buildOrderBy(orderBy: string | undefined, orderDir: "asc" | "desc") {
  if (orderBy === "project") {
    return { project: { name: orderDir } };
  }
  const field = orderBy && SORTABLE_FIELDS.includes(orderBy) ? orderBy : "createdAt";
  return { [field]: orderDir };
}

export const taskRepository = {
  async findAll(
    companyId: string,
    userId: string,
    userRole: Role,
    options: ListQueryOptions,
    projectId?: string
  ): Promise<PaginatedResult<TaskWithRelations>> {
    const where = buildWhere(companyId, userId, userRole, options, projectId);
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir);

    const [data, total] = await Promise.all([
      prisma.task.findMany({
        where,
        select: taskWithRelationsSelect,
        orderBy,
        skip,
        take: options.pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(
    id: string,
    companyId: string,
    userId: string,
    userRole: Role
  ): Promise<TaskWithRelations | null> {
    const where =
      userRole === "FREELANCER"
        ? { id, project: { companyId }, assigneeId: userId }
        : { id, project: { companyId } };

    return prisma.task.findFirst({
      where,
      select: taskWithRelationsSelect,
    });
  },

  async findByIdAdmin(id: string, companyId: string): Promise<TaskWithRelations | null> {
    return prisma.task.findFirst({
      where: { id, project: { companyId } },
      select: taskWithRelationsSelect,
    });
  },

  async existsInCompany(id: string, companyId: string, userId: string, userRole: Role): Promise<boolean> {
    const where =
      userRole === "FREELANCER"
        ? { id, project: { companyId }, assigneeId: userId }
        : { id, project: { companyId } };

    const count = await prisma.task.count({ where });
    return count > 0;
  },

  async create(data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    dueDate?: Date;
    projectId: string;
    assigneeId?: string;
  }): Promise<TaskWithRelations> {
    return prisma.task.create({
      data,
      select: taskWithRelationsSelect,
    });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      title?: string;
      description?: string;
      status?: TaskStatus;
      dueDate?: Date;
      assigneeId?: string;
    }>
  ): Promise<TaskWithRelations> {
    const result = await prisma.task.updateMany({
      where: { id, project: { companyId } },
      data,
    });

    if (result.count === 0) {
      throw new HttpError(404, "Task not found");
    }

    const task = await prisma.task.findFirst({
      where: { id },
      select: taskWithRelationsSelect,
    });

    if (!task) {
      throw new HttpError(404, "Task not found");
    }

    return task;
  },

  async delete(id: string, companyId: string): Promise<TaskWithRelations> {
    const task = await prisma.task.findFirst({
      where: { id, project: { companyId } },
      select: taskWithRelationsSelect,
    });

    if (!task) {
      throw new HttpError(404, "Task not found");
    }

    await prisma.task.delete({ where: { id } });
    return task;
  },
};
