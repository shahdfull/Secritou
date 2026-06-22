import { documentRepository } from "../repositories/document.repository.js";
import type { EnhancedDocumentType, DocumentType, DocumentAccessLevel, Role } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { tenantValidation } from "./tenantValidation.service.js";
import { prisma } from "../config/prisma.js";
import { getSignedReadUrl } from "./upload.service.js";
import { HttpError } from "../utils/httpError.js";

type Viewer = { role: Role; clientId?: string | null };

export const documentService = {
  async getAll(
    options: ListQueryOptions & {
      companyId: string;
      clientId?: string;
      type?: DocumentType;
      enhancedType?: EnhancedDocumentType;
      projectId?: string;
      tags?: string[];
      search?: string;
    },
    viewer: Viewer
  ) {
    return documentRepository.findAll({
      ...options,
      role: viewer.role,
      viewerClientId: viewer.clientId,
    });
  },

  async getById(id: string, companyId: string, viewer: Viewer) {
    return documentRepository.findById(id, companyId, viewer);
  },

  async create(
    data: {
      name: string;
      title: string;
      description?: string;
      type: DocumentType;
      enhancedType?: EnhancedDocumentType;
      url: string;
      fileUrl?: string;
      fileKey?: string;
      version?: number;
      parentId?: string;
      tags?: string[];
      accessLevel?: DocumentAccessLevel;
      clientId?: string;
      projectId?: string;
      uploadedById: string;
      signedAt?: Date;
      signedByClientId?: string;
    },
    companyId: string
  ) {
    if (data.clientId) await tenantValidation.assertClientInCompany(data.clientId, companyId);
    return documentRepository.create({ ...data, companyId });
  },

  async update(
    id: string,
    companyId: string,
    data: Partial<{
      name: string;
      title: string;
      description: string;
      type: DocumentType;
      enhancedType: EnhancedDocumentType;
      url: string;
      fileUrl: string;
      fileKey: string;
      tags: string[];
      accessLevel: DocumentAccessLevel;
      projectId: string;
      clientId: string;
      signedAt: Date;
      signedByClientId: string;
    }>
  ) {
    return documentRepository.update(id, companyId, data);
  },

  async delete(id: string, companyId: string) {
    return documentRepository.delete(id, companyId);
  },

  async createVersion(
    id: string,
    companyId: string,
    data: { url: string; userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const original = await documentRepository.findById(id, companyId);
    if (!original) throw new Error("Document not found");

    const newVersion = await documentRepository.create({
      name: original.name,
      title: original.title,
      description: original.description ?? undefined,
      type: original.type as DocumentType,
      enhancedType: original.enhancedType as EnhancedDocumentType,
      url: data.url,
      fileUrl: original.fileUrl ?? undefined,
      fileKey: original.fileKey ?? undefined,
      version: original.version + 1,
      parentId: original.id,
      tags: original.tags,
      accessLevel: original.accessLevel,
      clientId: original.clientId ?? undefined,
      companyId: original.companyId,
      projectId: original.projectId ?? undefined,
      uploadedById: data.userId || original.uploadedById,
    });

    await documentRepository.addAccessLog(id, companyId, {
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
    return documentRepository.addAccessLog(id, companyId, data);
  },

  // CLIENT-only: sign the contract document. Guards: document must belong to the client's project,
  // and only a CONTRACT document can be signed (other types have no signature flow).
  async signDocument(documentId: string, clientId: string, companyId: string) {
    const doc = await prisma.document.findFirst({
      where: { id: documentId, companyId },
      include: { project: { select: { clientId: true } } },
    });
    if (!doc) throw new HttpError(404, "Document not found");
    if (doc.project?.clientId !== clientId) throw new HttpError(403, "Forbidden");
    if (doc.type !== "CONTRACT") throw new HttpError(400, "Only the contract document can be signed", "NOT_A_CONTRACT");
    if (doc.signedAt) throw new HttpError(409, "Document already signed", "ALREADY_SIGNED");
    return prisma.document.update({
      where: { id: documentId },
      data: { signedAt: new Date(), signedByClientId: clientId },
    });
  },

  // Returns a short-lived (1h) signed MinIO URL for the document. Guards: the viewer check
  // already happened in getById; this is called only after that succeeds.
  async getDownloadUrl(documentId: string, companyId: string, viewer: Viewer) {
    const doc = await documentRepository.findById(documentId, companyId, viewer);
    if (!doc) throw new HttpError(404, "Document not found");
    if (!doc.fileKey) throw new HttpError(400, "No file attached to this document");
    const url = await getSignedReadUrl(doc.fileKey, 3600);
    return { url, filename: `${doc.name}.pdf` };
  },
};
