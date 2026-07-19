import { documentRepository } from "../repositories/document.repository.js";
import type { DocumentType, DocumentAccessLevel, Role, Prisma } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { prisma } from "../config/prisma.js";
import { getSignedReadUrl, deleteFile } from "./upload.service.js";
import { HttpError } from "../utils/httpError.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";
import { env } from "../config/env.js";
import { notifyN8n } from "../utils/webhook.js";
import { clientRepository } from "../repositories/client.repository.js";

type Viewer = { role: Role; clientId?: string | null; serviceId?: string | null; userId?: string | null };

export const documentService = {
  async getAll(options: ListQueryOptions & { clientId?: string; type?: DocumentType; projectId?: string; taskId?: string; tags?: string[]; search?: string }, viewer: Viewer) {
    return documentRepository.findAll({ ...options, role: viewer.role, viewerClientId: viewer.clientId, viewerServiceId: viewer.serviceId, viewerUserId: viewer.userId });
  },

  async getById(id: string, viewer: Viewer) {
    return documentRepository.findById(id, viewer);
  },

  // SEC-063: a FREELANCER can now reach this route (previously always 403'd before reaching here —
  // ProjectDetailPage.tsx's "Mes livrables" tab called this with no server-side path that ever
  // accepted it). Restricted to depositing their own DELIVERABLE on a project they're actually
  // staffed on — anything else (a different type, a project with no task assigned to them) would
  // let a freelancer create/attach documents company-wide, well beyond "deposit my own deliverable".
  async create(data: { name: string; title: string; description?: string; type: DocumentType; url: string; fileUrl?: string; fileKey?: string; version?: number; parentId?: string; tags?: string[]; accessLevel?: DocumentAccessLevel; clientId?: string; projectId?: string; taskId?: string; invoiceId?: string; uploadedById: string; signedAt?: Date; signedByClientId?: string }, viewer: Viewer) {
    if (viewer.role === "FREELANCER") {
      if (data.type !== "DELIVERABLE") {
        throw new HttpError(403, "A freelancer can only deposit a DELIVERABLE", "FREELANCER_DELIVERABLE_ONLY");
      }
      if (!data.projectId) {
        throw new HttpError(403, "A freelancer must attach a deliverable to a project they're staffed on", "FREELANCER_DELIVERABLE_ONLY");
      }
      const staffed = await prisma.project.count({
        where: { id: data.projectId, tasks: { some: { assigneeId: viewer.userId ?? "__none__" } } },
      });
      if (staffed === 0) {
        throw new HttpError(403, "You are not staffed on this project", "FREELANCER_NOT_STAFFED");
      }
    }
    return documentRepository.create(data);
  },

  async update(id: string, data: Prisma.DocumentUncheckedUpdateInput) {
    return documentRepository.update(id, data);
  },

  async delete(id: string) {
    // Grab the storage key before the row disappears, then clean up the S3/MinIO
    // object best-effort (deleteFile swallows errors) so the bucket doesn't
    // accumulate orphans. createVersion copies fileKey onto the new version, so
    // only delete the object once no remaining document row references it.
    const doc = await prisma.document.findUnique({ where: { id }, select: { fileKey: true } });
    const deleted = await documentRepository.delete(id);
    if (doc?.fileKey) {
      const stillReferenced = await prisma.document.count({ where: { fileKey: doc.fileKey } });
      if (stillReferenced === 0) await deleteFile(doc.fileKey);
    }
    return deleted;
  },

  async createVersion(id: string, data: { url: string; userId?: string; ipAddress?: string; userAgent?: string }) {
    const original = await documentRepository.findById(id);
    if (!original) throw new Error("Document not found");

    const newVersion = await documentRepository.create({
      name: original.name,
      title: original.title,
      description: original.description ?? undefined,
      type: original.type as DocumentType,
      url: data.url,
      fileUrl: original.fileUrl ?? undefined,
      fileKey: original.fileKey ?? undefined,
      version: original.version + 1,
      parentId: original.id,
      tags: original.tags,
      accessLevel: original.accessLevel,
      clientId: original.clientId ?? undefined,
      projectId: original.projectId ?? undefined,
      uploadedById: data.userId || original.uploadedById || undefined,
    });

    await documentRepository.addAccessLog(id, { action: "VERSION_CREATED", userId: data.userId, ipAddress: data.ipAddress, userAgent: data.userAgent });

    return newVersion;
  },

  async logAccess(id: string, data: { action: string; userId?: string; ipAddress?: string; userAgent?: string }) {
    return documentRepository.addAccessLog(id, data);
  },

  // CLIENT-only: sign the contract document. `signingUserId` is the authenticated User's own
  // id (req.user.sub) — despite its name, Document.signedByClientId is a foreign key to
  // User.id (relation "SignedDocuments" on User), not Client.id. Writing clientId into it
  // always violated the FK constraint (SEC-023) — no client has ever been able to actually
  // sign a contract through this endpoint until this fix.
  async signDocument(documentId: string, clientId: string, signingUserId: string) {
    const doc = await prisma.document.findFirst({ where: { id: documentId }, include: { project: { select: { clientId: true, name: true } } } });
    if (!doc) throw new HttpError(404, "Document not found");
    // Ownership via either the linked project's client, OR the document's own direct
    // clientId (both are legitimate — createDocument allows a CONTRACT with no projectId,
    // see SEC-023). Checking only doc.project?.clientId permanently locked the client out
    // of signing any contract not attached to a project.
    const owningClientId = doc.project?.clientId ?? doc.clientId;
    if (owningClientId !== clientId) throw new HttpError(403, "Forbidden");
    if (doc.type !== "CONTRACT") throw new HttpError(400, "Only the contract document can be signed", "NOT_A_CONTRACT");
    if (doc.signedAt) throw new HttpError(409, "Document already signed", "ALREADY_SIGNED");
    const signed = await prisma.document.update({ where: { id: documentId }, data: { signedAt: new Date(), signedByClientId: signingUserId } });
    const admins = await userRepository.findAdmins();
    void enqueueNotifications(admins.map((admin) => ({
      userId: admin.id,
      title: "Contrat signé",
      message: `Le contrat "${doc.title}" (projet : ${doc.project?.name ?? "?"}) a été signé par le client.`,
      type: "DOCUMENT_SIGNED" as const,
      entityId: documentId,
      link: doc.projectId ? `${env.FRONTEND_URL}/app/projects/${doc.projectId}` : `${env.FRONTEND_URL}/app/projects`,
    })));

    const client = await clientRepository.findById(clientId).catch(() => null);
    void notifyN8n("document.contract_signed", {
      documentId,
      projectId: doc.projectId,
      clientId,
      clientName: client?.name,
      signedAt: signed.signedAt,
      adminUrl: doc.projectId ? `${env.FRONTEND_URL}/app/projects/${doc.projectId}` : `${env.FRONTEND_URL}/app/projects`,
    });

    return signed;
  },

  async getDownloadUrl(documentId: string, viewer: Viewer) {
    const doc = await documentRepository.findById(documentId, viewer);
    if (!doc) throw new HttpError(404, "Document not found");
    if (!doc.fileKey) throw new HttpError(400, "No file attached to this document");
    const url = await getSignedReadUrl(doc.fileKey, 3600);
    return { url, filename: `${doc.name}.pdf` };
  },
};
