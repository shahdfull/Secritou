import type { Request, Response } from "express";
import { proposalService } from "../services/proposal.service.js";
import { parseListQuery } from "../utils/listQuery.js";

function textQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const getProposals = async (req: Request, res: Response) => {
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    companyId: req.user!.companyId!,
    clientId: textQuery(req.query.clientId),
    status: textQuery(req.query.status) as never,
    search: textQuery(req.query.search),
  };
  const result = await proposalService.getAll(options);
  res.json({ data: result });
};

export const getProposalById = async (req: Request, res: Response) => {
  const proposal = await proposalService.getById(req.params.id, req.user!.companyId!);
  res.json({ data: proposal });
};

export const createProposal = async (req: Request, res: Response) => {
  const proposal = await proposalService.create(
    req.body,
    req.user!.companyId!
  );
  res.json({ data: proposal });
};

export const updateProposal = async (req: Request, res: Response) => {
  const proposal = await proposalService.update(req.params.id, req.user!.companyId!, req.body);
  res.json({ data: proposal });
};

export const deleteProposal = async (req: Request, res: Response) => {
  await proposalService.delete(req.params.id, req.user!.companyId!);
  res.json({ data: { success: true } });
};

export const sendProposal = async (req: Request, res: Response) => {
  const proposal = await proposalService.send(req.params.id, req.user!.companyId!);
  res.json({ data: proposal });
};

export const acceptProposal = async (req: Request, res: Response) => {
  const proposal = await proposalService.accept(req.params.id, req.user!.companyId!);
  res.json({ data: proposal });
};

export const rejectProposal = async (req: Request, res: Response) => {
  const proposal = await proposalService.reject(
    req.params.id,
    req.user!.companyId!,
    req.body.comment
  );
  res.json({ data: proposal });
};

export const viewProposal = async (req: Request, res: Response) => {
  const proposal = await proposalService.view(req.params.id, req.user!.companyId!);
  res.json({ data: proposal });
};

export const addProposalSection = async (req: Request, res: Response) => {
  const section = await proposalService.addSection(req.params.id, req.user!.companyId!, req.body);
  res.json({ data: section });
};

export const updateProposalSection = async (req: Request, res: Response) => {
  const section = await proposalService.updateSection(
    req.params.sectionId,
    req.user!.companyId!,
    req.body
  );
  res.json({ data: section });
};

export const deleteProposalSection = async (req: Request, res: Response) => {
  await proposalService.deleteSection(req.params.sectionId, req.user!.companyId!);
  res.json({ data: { success: true } });
};
