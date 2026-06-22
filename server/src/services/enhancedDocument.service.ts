import { enhancedDocumentRepository } from "../repositories/enhancedDocument.repository.js";
import type { EnhancedDocumentType, DocumentAccessLevel, Role } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { tenantValidation } from "./tenantValidation.service.js";

type Viewer = { role: Role; clientId?: string | null };

export const enhancedDocumentService = {
  async getAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      type?: EnhancedDocumentType;
      tags?: string[];
      search?: string;
    },
    viewer: Viewer
  ) {
    return enhancedDocumentRepository.findAll({
      ...options,
      role: viewer.role,
      viewerClientId: viewer.clientId,
    });
  },

  async getById(id: string, companyId: string, viewer: Viewer) {
    return enhancedDocumentRepository.findById(id, companyId, viewer);
  },

  async create(
    data: {
      name: string;
      description?: string;
      type?: EnhancedDocumentType;
      url: string;
      version?: number;
      parentId?: string;
      tags?: string[];
      accessLevel?: DocumentAccessLevel;
      clientId?: string;
      projectId?: string;
    },
    companyId: string
  ) {
    if (data.clientId) await tenantValidation.assertClientInCompany(data.clientId, companyId);
    return enhancedDocumentRepository.create({ ...data, companyId });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      name: string;
      description: string;
      type: EnhancedDocumentType;
      url: string;
      tags: string[];
      accessLevel: DocumentAccessLevel;
    }>
  ) {
    return enhancedDocumentRepository.update(id, companyId, data);
  },

  async delete(id: string, companyId: string) {
    return enhancedDocumentRepository.delete(id, companyId);
  },

  async createVersion(
    id: string,
    companyId: string,
    data: { url: string; userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const original = await enhancedDocumentRepository.findById(id, companyId);
    if (!original) throw new Error("Document not found");

    const newVersion = await enhancedDocumentRepository.create({
      name: original.name,
      description: original.description ?? undefined,
      type: original.type,
      url: data.url,
      version: original.version + 1,
      parentId: original.id,
      tags: original.tags,
      accessLevel: original.accessLevel,
      clientId: original.clientId ?? undefined,
      companyId: original.companyId,
      projectId: original.projectId ?? undefined,
    });

    await enhancedDocumentRepository.addAccessLog(id, companyId, {
      action: "VERSION_CREATED",
      userId: data.userId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    return newVersion;
  },

  async logAccess(
    id: string,
    companyId: string,
    data: { action: string; userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    return enhancedDocumentRepository.addAccessLog(id, companyId, data);
  },
};
