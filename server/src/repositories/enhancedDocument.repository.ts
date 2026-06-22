import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import type {
  EnhancedDocument,
  EnhancedDocumentType,
  DocumentAccessLevel,
  Role,
} from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

// Maps a role to the document access levels it may see. The accessLevel enum predates MANAGER;
// a MANAGER is treated as agency staff (same visibility as ADMIN). This is the actual access
// gate — previously accessLevel was stored but never enforced in any query.
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

export const enhancedDocumentRepository = {
  async findAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      type?: EnhancedDocumentType;
      tags?: string[];
      search?: string;
      role?: Role;
      viewerClientId?: string | null;
    }
  ): Promise<
    PaginatedResult<EnhancedDocument & { client: { name: string } | null }>
  > {
    const where: Prisma.EnhancedDocumentWhereInput = { companyId: options.companyId };
    if (options.clientId) where.clientId = options.clientId;
    // Enforce the document access level by role. Without this, accessLevel was decorative.
    if (options.role) {
      where.accessLevel = { in: visibleAccessLevels(options.role) };
      // A CLIENT additionally only ever sees documents attached to their own client record.
      if (options.role === "CLIENT") {
        where.clientId = options.viewerClientId ?? "__none__";
      }
    }
    if (options.type) where.type = options.type;
    if (options.tags && options.tags.length > 0) {
      where.tags = { hasSome: options.tags };
    }
    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: "insensitive" } },
        { description: { contains: options.search, mode: "insensitive" } },
      ];
    }

    const skip = (options.page - 1) * options.pageSize;

    const [data, total] = await Promise.all([
      prisma.enhancedDocument.findMany({
        where,
        skip,
        take: options.pageSize,
        orderBy: { [options.orderBy || "createdAt"]: options.orderDir || "desc" },
        include: { client: { select: { name: true } } },
      }),
      prisma.enhancedDocument.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(
    id: string,
    companyId: string,
    viewer?: { role: Role; clientId?: string | null }
  ) {
    const where: Prisma.EnhancedDocumentWhereInput = { id, companyId };
    if (viewer) {
      where.accessLevel = { in: visibleAccessLevels(viewer.role) };
      if (viewer.role === "CLIENT") {
        where.clientId = viewer.clientId ?? "__none__";
      }
    }
    return prisma.enhancedDocument.findFirst({
      where,
      include: {
        client: true,
        children: true,
        parent: true,
        accessLog: {
          include: { user: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });
  },

  async create(data: {
    name: string;
    description?: string;
    type?: EnhancedDocumentType;
    url: string;
    version?: number;
    parentId?: string;
    tags?: string[];
    accessLevel?: DocumentAccessLevel;
    clientId?: string;
    companyId: string;
    projectId?: string;
  }) {
    return prisma.enhancedDocument.create({ data });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      name: string;
      description: string;
      type: EnhancedDocumentType;
      url: string;
      version: number;
      tags: string[];
      accessLevel: DocumentAccessLevel;
    }>
  ) {
    return prisma.enhancedDocument.update({ where: { id, companyId }, data });
  },

  async delete(id: string, companyId: string) {
    return prisma.enhancedDocument.delete({ where: { id, companyId } });
  },

  async addAccessLog(
    documentId: string,
    companyId: string,
    data: {
      action: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ) {
    await prisma.enhancedDocument.findUniqueOrThrow({ where: { id: documentId, companyId }, select: { id: true } });
    return prisma.documentAccessLog.create({ data: { ...data, documentId } });
  },
};
