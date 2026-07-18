// Task Repository - Data access layer
import { prisma, prismaRead } from "../config/prisma.js";
import type { TaskStatus, Role, Prisma } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { buildTextSearchFilter } from "../utils/listQuery.js";
import { taskWithRelationsSelect } from "../utils/prismaSelects.js";
import { HttpError } from "../utils/httpError.js";

// priority added (SEC-047): TasksListView.tsx already renders a clickable "priority" sort header
// for non-freelancers, but the server rejected it here — clicking it silently fell back to
// createdAt. The Priority enum is declared LOW→NORMAL→HIGH→URGENT, so Postgres orders it in that
// sequence: orderDir "desc" surfaces URGENT first. This only makes the existing header work; it
// does not change the default ordering (still createdAt).
const SORTABLE_FIELDS = ["title", "status", "priority", "dueDate", "createdAt"];

type TaskWithRelations = Prisma.TaskGetPayload<{ select: typeof taskWithRelationsSelect }>;

function buildWhere(
  userId: string,
  userRole: Role,
  options: ListQueryOptions,
  projectId?: string,
  userServiceId?: string | null
) {
  // A MANAGER only sees tasks whose project belongs to their service (pole). "__none__"
  // guarantees no match when the manager has no service. archivedAt filtered alongside
  // deletedAt (SEC-041 follow-up): once SEC-040 exposed a real "Archiver" button in the UI,
  // an archived project's tasks kept showing up here as if nothing had changed, contradicting
  // both the project detail page (vanishes from every list) and the write path (blocked with
  // 409 PROJECT_ARCHIVED, invisible from this read side until now).
  const projectFilter =
    userRole === "MANAGER"
      ? { serviceId: userServiceId ?? "__none__", deletedAt: null, archivedAt: null }
      : { deletedAt: null, archivedAt: null };
  const base = {
    project: projectFilter,
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
  if (orderBy === "project") return { project: { name: orderDir } };
  const field = orderBy && SORTABLE_FIELDS.includes(orderBy) ? orderBy : "createdAt";
  return { [field]: orderDir };
}

export const taskRepository = {
  async findAll(
    userId: string,
    userRole: Role,
    options: ListQueryOptions,
    projectId?: string,
    userServiceId?: string | null
  ): Promise<PaginatedResult<TaskWithRelations>> {
    const where = buildWhere(userId, userRole, options, projectId, userServiceId);
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir);

    const [data, total] = await Promise.all([
      prismaRead.task.findMany({ where, select: taskWithRelationsSelect, orderBy, skip, take: options.pageSize }),
      prismaRead.task.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(
    id: string,
    userId: string,
    userRole: Role,
    userServiceId?: string | null
  ): Promise<TaskWithRelations | null> {
    let where: Prisma.TaskWhereInput;
    if (userRole === "FREELANCER") {
      where = { id, assigneeId: userId, project: { deletedAt: null, archivedAt: null } };
    } else if (userRole === "MANAGER") {
      where = { id, project: { serviceId: userServiceId ?? "__none__", deletedAt: null, archivedAt: null } };
    } else {
      where = { id, project: { deletedAt: null, archivedAt: null } };
    }
    return prismaRead.task.findFirst({ where, select: taskWithRelationsSelect });
  },

  // Reads via the primary connection, not prismaRead: both callers (task.service.ts's
  // updateTask/deleteTask) use this as an immediately-preceding read before writing the same
  // row — a lagging replica could otherwise base that write on stale data.
  async findByIdAdmin(id: string): Promise<TaskWithRelations | null> {
    return prisma.task.findFirst({ where: { id }, select: taskWithRelationsSelect });
  },

  async existsInCompany(id: string, userId: string, userRole: Role, userServiceId?: string | null): Promise<boolean> {
    let where: Prisma.TaskWhereInput;
    if (userRole === "FREELANCER") {
      where = { id, assigneeId: userId, project: { deletedAt: null, archivedAt: null } };
    } else if (userRole === "MANAGER") {
      where = { id, project: { serviceId: userServiceId ?? "__none__", deletedAt: null, archivedAt: null } };
    } else {
      where = { id, project: { deletedAt: null, archivedAt: null } };
    }
    const count = await prismaRead.task.count({ where });
    return count > 0;
  },

  async create(data: { title: string; description?: string; status?: TaskStatus; startDate?: Date; dueDate?: Date; projectId: string; assigneeId?: string }): Promise<TaskWithRelations> {
    return prisma.task.create({ data, select: taskWithRelationsSelect });
  },

  async update(id: string, data: Prisma.TaskUpdateManyMutationInput): Promise<TaskWithRelations> {
    const result = await prisma.task.updateMany({ where: { id }, data });
    if (result.count === 0) throw new HttpError(404, "Task not found");
    const task = await prisma.task.findFirst({ where: { id }, select: taskWithRelationsSelect });
    if (!task) throw new HttpError(404, "Task not found");
    return task;
  },

  async delete(id: string): Promise<TaskWithRelations> {
    const task = await prisma.task.findFirst({ where: { id }, select: taskWithRelationsSelect });
    if (!task) throw new HttpError(404, "Task not found");
    await prisma.task.delete({ where: { id } });
    return task;
  },
};
