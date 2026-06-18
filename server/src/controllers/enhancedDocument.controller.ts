import type { Request, Response } from "express";
import { enhancedDocumentService } from "../services/enhancedDocument.service.js";
import { parseListQuery } from "../utils/listQuery.js";

function textQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const getEnhancedDocuments = async (req: Request, res: Response) => {
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    companyId: req.user!.companyId!,
    clientId: textQuery(req.query.clientId),
    type: textQuery(req.query.type) as never,
    tags: typeof req.query.tags === "string" ? req.query.tags.split(",") : undefined,
    search: textQuery(req.query.search),
  };
  const result = await enhancedDocumentService.getAll(options);
  res.json({ data: result });
};

export const getEnhancedDocumentById = async (req: Request, res: Response) => {
  const document = await enhancedDocumentService.getById(req.params.id, req.user!.companyId!);
  // Log access
  await enhancedDocumentService.logAccess(req.params.id, req.user!.companyId!, {
    action: "VIEW",
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });
  res.json({ data: document });
};

export const createEnhancedDocument = async (req: Request, res: Response) => {
  const document = await enhancedDocumentService.create(
    req.body,
    req.user!.companyId!
  );
  res.json({ data: document });
};

export const updateEnhancedDocument = async (req: Request, res: Response) => {
  const document = await enhancedDocumentService.update(req.params.id, req.user!.companyId!, req.body);
  res.json({ data: document });
};

export const deleteEnhancedDocument = async (req: Request, res: Response) => {
  await enhancedDocumentService.delete(req.params.id, req.user!.companyId!);
  res.json({ data: { success: true } });
};

export const createDocumentVersion = async (req: Request, res: Response) => {
  const document = await enhancedDocumentService.createVersion(req.params.id, req.user!.companyId!, {
    ...req.body,
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });
  res.json({ data: document });
};
