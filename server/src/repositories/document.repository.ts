import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import type { Document, DocumentType, DocumentAccessLevel, Role } from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";
import { documentListSelect } from "../utils/prismaSelects.js";

export type DocumentListItem = Omit<Document, "description"> & { client: { name: string } | null };

export function visibleAccessLevels(role: Role): DocumentAccessLevel[] {
  switch (role) {
    case "ADMIN":
    case "MANAGER":
      return ["ADMIN_ONLY", "ADMIN_FREELANCER", "CLIENT_ADMIN", "ALL"];
    case "FREELANCER":
      return ["ADMIN_FREELANCER", "ALL"];
    case "CLIENT":
      return ["CLIENT_ADMIN", "ALL"];
    default:
      return ["ALL"];
  }
}

export const documentRepository = {
  async findAll(
    options: ListQueryOptions & {
      clientId?: string;
      type?: DocumentType;
      projectId?: string;
      taskId?: string;
      tags?: string[];
      search?: string;
      role?: Role;
      viewerClientId?: string | null;
      viewerServiceId?: string | null;
      viewerUserId?: string | null;
    }
  ): Promise<PaginatedResult<DocumentListItem>> {
    const where: Prisma.DocumentWhereInput = {};
    if (options.clientId) where.clientId = options.clientId;
    if (options.projectId) where.projectId = options.projectId;
    if (options.taskId) where.taskId = options.taskId;
    if (options.role) {
      where.accessLevel = { in: visibleAccessLevels(options.role) };
      if (options.role === "CLIENT") {
        where.clientId = options.viewerClientId ?? "__none__";
      } else if (options.role === "MANAGER" && options.viewerServiceId !== undefined) {
        where.client = { projects: { some: { serviceId: options.viewerServiceId ?? "__none__" } } };
      } else if (options.role === "FREELANCER") {
        // A FREELANCER only sees documents attached to a project they have a task on, OR a
        // document attached directly to one of their own assigned tasks (SEC-060: task
        // attachments can exist without a projectId) — previously unscoped by project alone,
        // letting any freelancer list every ADMIN_FREELANCER/ALL document company-wide
        // regardless of which project they're staffed on. Written as `AND` (not `where.OR`,
        // which the text-search branch below also assigns and would silently overwrite this
        // scope if both were active in the same request).
        where.AND = [
          {
            OR: [
              { project: { tasks: { some: { assigneeId: options.viewerUserId ?? "__none__" } } } },
              { task: { assigneeId: options.viewerUserId ?? "__none__" } },
            ],
          },
        ];
      }
    }
    if (options.type) where.type = options.type;
    if (options.tags && options.tags.length > 0) where.tags = { hasSome: options.tags };
    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: "insensitive" } },
        { title: { contains: options.search, mode: "insensitive" } },
        { description: { contains: options.search, mode: "insensitive" } },
      ];
    }

    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: { [options.orderBy || "createdAt"]: options.orderDir || "desc" },
        select: documentListSelect,
      }),
      prisma.document.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string, viewer?: { role: Role; clientId?: string | null; serviceId?: string | null; userId?: string | null }) {
    const where: Prisma.DocumentWhereInput = { id };
    if (viewer) {
      where.accessLevel = { in: visibleAccessLevels(viewer.role) };
      if (viewer.role === "CLIENT") where.clientId = viewer.clientId ?? "__none__";
      if (viewer.role === "MANAGER" && viewer.serviceId !== undefined) {
        where.client = { projects: { some: { serviceId: viewer.serviceId ?? "__none__" } } };
      }
      if (viewer.role === "FREELANCER") {
        // SEC-060: a document attached directly to a task (no projectId) needs its own branch —
        // where.project on a null relation never matches, so a task-only attachment would
        // otherwise be invisible to the very freelancer it's meant for.
        where.OR = [
          { project: { tasks: { some: { assigneeId: viewer.userId ?? "__none__" } } } },
          { task: { assigneeId: viewer.userId ?? "__none__" } },
        ];
      }
    }
    return prisma.document.findFirst({
      where,
      include: {
        client: true,
        children: true,
        parent: true,
        accessLog: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
  },

  async create(data: {
    name: string;
    title: string;
    description?: string;
    type: DocumentType;
    url: string;
    fileUrl?: string;
    fileKey?: string;
    version?: number;
    parentId?: string;
    tags?: string[];
    accessLevel?: DocumentAccessLevel;
    clientId?: string;
    projectId?: string;
    taskId?: string;
    invoiceId?: string;
    uploadedById?: string;
    signedAt?: Date;
    signedByClientId?: string;
  }) {
    return prisma.document.create({ data });
  },

  async update(id: string, data: Prisma.DocumentUncheckedUpdateInput) {
    return prisma.document.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.document.delete({ where: { id } });
  },

  // Latest version of a given document type for a project — used to find the Document a
  // regeneration (e.g. AI-written SPECS after brief submission) should version off of.
  async findLatestByProjectAndType(projectId: string, type: DocumentType) {
    return prisma.document.findFirst({
      where: { projectId, type },
      orderBy: { version: "desc" },
    });
  },

  async addAccessLog(documentId: string, data: { action: string; userId?: string; ipAddress?: string; userAgent?: string; contentHash?: string }) {
    await prisma.document.findUniqueOrThrow({ where: { id: documentId }, select: { id: true } });
    return prisma.documentAccessLog.create({ data: { ...data, documentId } });
  },
};
