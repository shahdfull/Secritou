import type { Request, Response } from "express";
import { approvalService } from "../services/approval.service.js";
import { parseListQuery } from "../utils/listQuery.js";

function queryText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const getApprovals = async (req: Request, res: Response) => {
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    companyId: req.user!.companyId!,
    clientId: queryText(req.query.clientId),
    status: queryText(req.query.status) as never,
    search: queryText(req.query.search),
  };
  const result = await approvalService.getAll(options);
  res.json({ data: result });
};

export const getApprovalById = async (req: Request, res: Response) => {
  const approval = await approvalService.getById(req.params.id, req.user!.companyId!);
  res.json({ data: approval });
};

export const createApproval = async (req: Request, res: Response) => {
  const approval = await approvalService.create(
    req.body,
    req.user!.companyId!
  );
  res.json({ data: approval });
};

export const updateApproval = async (req: Request, res: Response) => {
  const approval = await approvalService.update(req.params.id, req.user!.companyId!, req.body);
  res.json({ data: approval });
};

export const deleteApproval = async (req: Request, res: Response) => {
  await approvalService.delete(req.params.id, req.user!.companyId!);
  res.json({ data: { success: true } });
};

export const approveApproval = async (req: Request, res: Response) => {
  const approval = await approvalService.approve(
    req.params.id,
    req.user!.companyId!,
    req.body.comment,
    req.user?.id
  );
  res.json({ data: approval });
};

export const rejectApproval = async (req: Request, res: Response) => {
  const approval = await approvalService.reject(
    req.params.id,
    req.user!.companyId!,
    req.body.comment,
    req.user?.id
  );
  res.json({ data: approval });
};

export const commentApproval = async (req: Request, res: Response) => {
  const approval = await approvalService.comment(
    req.params.id,
    req.user!.companyId!,
    req.body.comment,
    req.user?.id
  );
  res.json({ data: approval });
};

export const addApprovalAttachment = async (req: Request, res: Response) => {
  const attachment = await approvalService.addAttachment(
    req.params.id,
    req.user!.companyId!,
    req.body
  );
  res.json({ data: attachment });
};

export const deleteApprovalAttachment = async (req: Request, res: Response) => {
  await approvalService.deleteAttachment(req.params.attachmentId, req.user!.companyId!);
  res.json({ data: { success: true } });
};
