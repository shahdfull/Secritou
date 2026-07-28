import type { Request, Response } from "express";
import { commissionService } from "../services/commission.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import type { CommissionStatus } from "@prisma/client";

function textQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const getProjectCommissionSplits = async (req: Request, res: Response) => {
  const state = await commissionService.getProjectSplitState(req.params.projectId as string);
  res.json({
    data: state.splits,
    commissionSplitMode: state.commissionSplitMode,
    commissionSplitDesynced: state.commissionSplitDesynced,
    payoutBudget: state.payoutBudget,
    suggestedPayoutBudget: state.suggestedPayoutBudget,
  });
};

export const resetProjectCommissionSplitToAuto = async (req: Request, res: Response) => {
  const splits = await commissionService.resetToAutoSplit(req.params.projectId as string);
  res.status(200).json({ data: splits });
};

export const getProjectCommissionSplitHistory = async (req: Request, res: Response) => {
  const history = await commissionService.getSplitHistory(req.params.projectId as string);
  res.json({ data: history });
};

export const setProjectCommissionSplits = async (req: Request, res: Response) => {
  const splits = await commissionService.setSplits(req.params.projectId as string, req.body.splits);
  res.status(200).json({ data: splits });
};

export const setProjectCommissionModeToPerTask = async (req: Request, res: Response) => {
  const splits = await commissionService.setSplitToPerTask(req.params.projectId as string);
  res.status(200).json({ data: splits });
};

export const setProjectPayoutBudget = async (req: Request, res: Response) => {
  const result = await commissionService.setProjectPayoutBudget(req.params.projectId as string, req.body.payoutBudget);
  res.status(200).json({ data: result });
};

export const getCommissions = async (req: Request, res: Response) => {
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    partnerId: textQuery(req.query.partnerId),
    status: textQuery(req.query.status) as CommissionStatus | undefined,
  };
  const result = await commissionService.getAll(options);
  res.json(result);
};

export const getCommissionsOwedSummary = async (_req: Request, res: Response) => {
  const summary = await commissionService.getOwedSummary();
  res.json({ data: summary });
};

// Self-service views for a MANAGER checking their own payouts — scoped to the
// authenticated user regardless of any partnerId query param.
export const getMyCommissions = async (req: Request, res: Response) => {
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    partnerId: req.user!.sub as string,
    status: textQuery(req.query.status) as CommissionStatus | undefined,
  };
  const result = await commissionService.getAll(options);
  res.json(result);
};

export const getMyCommissionsSummary = async (req: Request, res: Response) => {
  const summary = await commissionService.getOwedSummaryForPartner(req.user!.sub as string);
  res.json({ data: summary });
};

export const getMySplitForProject = async (req: Request, res: Response) => {
  const split = await commissionService.getMySplitForProject(req.params.projectId as string, req.user!.sub as string);
  res.json({ data: split });
};

export const markCommissionPaid = async (req: Request, res: Response) => {
  const commission = await commissionService.markPaid(req.params.id as string);
  res.json({ data: commission });
};
