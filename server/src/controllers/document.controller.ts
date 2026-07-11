import type { Request, Response } from "express";
import { documentService } from "../services/document.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { HttpError } from "../utils/httpError.js";
import { DocumentType } from "@prisma/client";
import { COMPANY_ID } from "../config/constants.js";
import { buildServiceScope } from "../utils/serviceScope.js";

function textQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// `url`/`fileUrl` persist a long-lived (7-day) pre-signed S3 link (see uploadFile in
// upload.service.ts). Never forward it to the client: any consumer that needs to open/download
// the file must go through GET /documents/:id/download, which mints a short-TTL URL on demand
// after re-checking scope.
function redactStorageUrl<T extends { url?: unknown; fileUrl?: unknown }>(doc: T): Omit<T, "url" | "fileUrl"> {
  const { url, fileUrl, ...rest } = doc;
  return rest;
}

export const getDocuments = async (req: Request, res: Response) => {
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    clientId: textQuery(req.query.clientId),
    type: textQuery(req.query.type) as DocumentType | undefined,
    projectId: textQuery(req.query.projectId),
    tags: typeof req.query.tags === "string" ? req.query.tags.split(",") : undefined,
    search: textQuery(req.query.search),
  };
  const scope = req.user!.role === "MANAGER" ? await buildServiceScope(req) : undefined;
  const result = await documentService.getAll(options, {
    role: req.user!.role,
    clientId: req.user!.clientId,
    serviceId: scope?.userServiceId,
  });
  res.json({ data: { ...result, data: result.data.map(redactStorageUrl) } });
};

export const getDocumentById = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const document = await documentService.getById(id, {
    role: req.user!.role,
    clientId: req.user!.clientId,
  });
  // Don't log a VIEW (or leak existence) for a document the viewer isn't allowed to see.
  if (!document) throw new HttpError(404, "Document not found");
  await documentService.logAccess(id, {
    action: "VIEW",
    userId: req.user?.sub as string | undefined,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });
  res.json({ data: redactStorageUrl(document) });
};

export const createDocument = async (req: Request, res: Response) => {
  const document = await documentService.create({
    ...req.body,
    uploadedById: req.user!.sub,
  });
  res.status(201).json({ data: document });
};

export const updateDocument = async (req: Request, res: Response) => {
  const document = await documentService.update(req.params.id as string, req.body);
  res.json({ data: document });
};

export const deleteDocument = async (req: Request, res: Response) => {
  await documentService.delete(req.params.id as string);
  res.status(204).send();
};

export const createDocumentVersion = async (req: Request, res: Response) => {
  const document = await documentService.createVersion(req.params.id as string, {
    ...req.body,
    userId: req.user?.sub as string | undefined,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });
  res.status(201).json({ data: document });
};

export const signDocument = async (req: Request, res: Response) => {
  const clientId = req.user!.clientId;
  if (!clientId) throw new HttpError(403, "Client access required");
  const document = await documentService.signDocument(
    req.params.id as string,
    clientId
  );
  res.json({ data: document });
};

export const downloadDocument = async (req: Request, res: Response) => {
  const result = await documentService.getDownloadUrl(
    req.params.id as string,
    { role: req.user!.role, clientId: req.user!.clientId }
  );
  res.json({ data: result });
};
