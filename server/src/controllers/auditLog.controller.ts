import type { Request, Response } from "express";
import { auditLogService } from "../services/auditLog.service.js";
import { parseListQuery } from "../utils/listQuery.js";

function textQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// SEC-114: ADMIN-only (enforced by authorize("ADMIN") in auditLog.routes.ts) — the audit trail
// itself has no per-pole/per-role scoping to apply here, unlike most other list endpoints in
// this repo (it spans every module by design).
export const getAuditLog = async (req: Request, res: Response) => {
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    entityType: textQuery(req.query.entityType),
    entityId: textQuery(req.query.entityId),
    actorId: textQuery(req.query.actorId),
    action: textQuery(req.query.action),
  };
  const result = await auditLogService.findAll(options);
  res.json({ data: result });
};

export const getAuditLogEntityTypes = async (_req: Request, res: Response) => {
  const entityTypes = await auditLogService.findDistinctEntityTypes();
  res.json({ data: entityTypes });
};
