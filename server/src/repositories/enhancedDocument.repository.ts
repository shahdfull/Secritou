import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import type {
  EnhancedDocument,
  EnhancedDocumentType,
  DocumentAccessLevel,
} from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

export const enhancedDocumentRepository = {
  async findAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      type?: EnhancedDocumentType;
      tags?: string[];
      search?: string;
    }
  ): Promise<
    PaginatedResult<EnhancedDocument & { client: { name: string } | null }>
  > {
    const where: Prisma.EnhancedDocumentWhereInput = { companyId: options.companyId };
    if (options.clientId) where.clientId = options.clientId;
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

  async findById(id: string, companyId: string) {
    return prisma.enhancedDocument.findUnique({
      where: { id, companyId },
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
