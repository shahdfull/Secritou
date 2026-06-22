import { prisma } from "../config/prisma.js";
import { COMPANY_ID } from "../config/constants.js";
import { Prisma } from "@prisma/client";
import type {
  Document,
  DocumentType,
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

export const documentRepository = {
  async findAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      type?: DocumentType;
      projectId?: string;
      tags?: string[];
      search?: string;
      role?: Role;
      viewerClientId?: string | null;
    }
  ): Promise<
    PaginatedResult<Document & { client: { name: string } | null }>
  > {
    const where: Prisma.DocumentWhereInput = { companyId: options.companyId };
    if (options.clientId) where.clientId = options.clientId;
    if (options.projectId) where.projectId = options.projectId;
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
        include: { client: { select: { name: true } } },
      }),
      prisma.document.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(
    id: string,
    companyId: string = COMPANY_ID,
    viewer?: { role: Role; clientId?: string | null }
  ) {
    const where: Prisma.DocumentWhereInput = { id, companyId };
    if (viewer) {
      where.accessLevel = { in: visibleAccessLevels(viewer.role) };
      if (viewer.role === "CLIENT") {
        where.clientId = viewer.clientId ?? "__none__";
      }
    }
    return prisma.document.findFirst({
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
    companyId: string;
    projectId?: string;
    uploadedById: string;
    signedAt?: Date;
    signedByClientId?: string;
  }) {
    return prisma.document.create({ data });
  },

  async update(
    id: string,
    companyId: string = COMPANY_ID,
    data: Partial<{
      name: string;
      title: string;
      description: string;
      type: DocumentType;
      url: string;
      fileUrl: string;
      fileKey: string;
      version: number;
      tags: string[];
      accessLevel: DocumentAccessLevel;
      projectId: string;
      clientId: string;
      signedAt: Date;
      signedByClientId: string;
    }>
  ) {
    return prisma.document.update({ where: { id, companyId }, data });
  },

  async delete(id: string, companyId: string = COMPANY_ID) {
    return prisma.document.delete({ where: { id, companyId } });
  },

  async addAccessLog(
    documentId: string,
    companyId: string = COMPANY_ID,
    data: {
      action: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ) {
    await prisma.document.findUniqueOrThrow({ where: { id: documentId, companyId }, select: { id: true } });
    return prisma.documentAccessLog.create({ data: { ...data, documentId } });
  },
};
