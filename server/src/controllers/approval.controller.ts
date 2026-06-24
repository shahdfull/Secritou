import type { Request, Response } from "express";
import { approvalService } from "../services/approval.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { ApprovalStatus } from "@prisma/client";
import { HttpError } from "../utils/httpError.js";
import { COMPANY_ID } from "../config/constants.js";
import { buildServiceScope } from "../utils/serviceScope.js";

function queryText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const getMyApprovals = async (req: Request, res: Response) => {
  const clientId = req.user!.clientId!;
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    clientId,
    status: queryText(req.query.status) as ApprovalStatus | undefined,
  };
  const result = await approvalService.getAllByClientId(clientId, options);
  res.json({ data: result });
};

export const respondToApproval = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { action, comment } = req.body as { action: string; comment?: string };
  const clientId = req.user!.clientId as string;
  const approval = await approvalService.getByIdForClient(id, clientId);
  if (!approval) throw new HttpError(404, "Approval not found");
  if (approval.clientId !== clientId) throw new HttpError(403, "Forbidden");
  const userId = req.user!.sub as string;
  if (action === "approve") {
    const result = await approvalService.approve(id, comment, userId);
    return res.json({ data: result });
  }
  if (action === "reject") {
    const result = await approvalService.reject(id, comment, userId);
    return res.json({ data: result });
  }
  if (action === "comment") {
    const result = await approvalService.comment(id, comment ?? "", userId);
    return res.json({ data: result });
  }
  throw new HttpError(400, "Invalid action : use 'approve', 'reject', or 'comment'");
};

export const getApprovals = async (req: Request, res: Response) => {
  const scope = req.user!.role === "MANAGER" ? await buildServiceScope(req) : undefined;
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    clientId: queryText(req.query.clientId),
    status: queryText(req.query.status) as ApprovalStatus | undefined,
    search: queryText(req.query.search),
    serviceId: scope?.userServiceId,
  };
  const result = await approvalService.getAll(options);
  res.json({ data: result });
};

export const getApprovalById = async (req: Request, res: Response) => {
  const approval = await approvalService.getById(req.params.id as string);
  res.json({ data: approval });
};

export const createApproval = async (req: Request, res: Response) => {
  const approval = await approvalService.create(
    req.body,
    req.user!.sub as string
  );
  res.json({ data: approval });
};

export const updateApproval = async (req: Request, res: Response) => {
  const approval = await approvalService.update(req.params.id as string, req.body);
  res.json({ data: approval });
};

export const deleteApproval = async (req: Request, res: Response) => {
  await approvalService.delete(req.params.id as string);
  res.status(204).send();
};

export const approveApproval = async (req: Request, res: Response) => {
  const approval = await approvalService.approve(
    req.params.id as string,
    req.body.comment,
    req.user?.sub as string
  );
  res.json({ data: approval });
};

export const rejectApproval = async (req: Request, res: Response) => {
  const approval = await approvalService.reject(
    req.params.id as string,
    req.body.comment,
    req.user?.sub as string
  );
  res.json({ data: approval });
};

export const commentApproval = async (req: Request, res: Response) => {
  const approval = await approvalService.comment(
    req.params.id as string,
    req.body.comment,
    req.user?.sub as string
  );
  res.json({ data: approval });
};

export const addApprovalAttachment = async (req: Request, res: Response) => {
  const attachment = await approvalService.addAttachment(
    req.params.id as string,
    req.body
  );
  res.status(201).json({ data: attachment });
};

export const deleteApprovalAttachment = async (req: Request, res: Response) => {
  await approvalService.deleteAttachment(req.params.attachmentId as string);
  res.status(204).send();
};
