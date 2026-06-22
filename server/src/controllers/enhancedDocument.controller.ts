import type { Request, Response } from "express";
import { enhancedDocumentService } from "../services/enhancedDocument.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { HttpError } from "../utils/httpError.js";
import { EnhancedDocumentType } from "@prisma/client";

function textQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const getEnhancedDocuments = async (req: Request, res: Response) => {
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    companyId: req.user!.companyId!,
    clientId: textQuery(req.query.clientId),
    type: textQuery(req.query.type) as EnhancedDocumentType | undefined,
    tags: typeof req.query.tags === "string" ? req.query.tags.split(",") : undefined,
    search: textQuery(req.query.search),
  };
  const result = await enhancedDocumentService.getAll(options, {
    role: req.user!.role,
    clientId: req.user!.clientId,
  });
  res.json({ data: result });
};

export const getEnhancedDocumentById = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const companyId = req.user!.companyId as string;
  const document = await enhancedDocumentService.getById(id, companyId, {
    role: req.user!.role,
    clientId: req.user!.clientId,
  });
  // Don't log a VIEW (or leak existence) for a document the viewer isn't allowed to see.
  if (!document) throw new HttpError(404, "Document not found");
  await enhancedDocumentService.logAccess(id, companyId, {
    action: "VIEW",
    userId: req.user?.sub as string | undefined,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });
  res.json({ data: document });
};

export const createEnhancedDocument = async (req: Request, res: Response) => {
  const document = await enhancedDocumentService.create(
    req.body,
    req.user!.companyId as string
  );
  res.status(201).json({ data: document });
};

export const updateEnhancedDocument = async (req: Request, res: Response) => {
  const document = await enhancedDocumentService.update(req.params.id as string, req.user!.companyId as string, req.body);
  res.json({ data: document });
};

export const deleteEnhancedDocument = async (req: Request, res: Response) => {
  await enhancedDocumentService.delete(req.params.id as string, req.user!.companyId as string);
  res.status(204).send();
};

export const createDocumentVersion = async (req: Request, res: Response) => {
  const document = await enhancedDocumentService.createVersion(req.params.id as string, req.user!.companyId as string, {
    ...req.body,
    userId: req.user?.sub as string | undefined,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });
  res.status(201).json({ data: document });
};
