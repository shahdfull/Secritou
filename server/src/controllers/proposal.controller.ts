import type { Request, Response } from "express";
import { proposalService } from "../services/proposal.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { HttpError } from "../utils/httpError.js";
import { ProposalStatus } from "@prisma/client";
import { buildServiceScope } from "../utils/serviceScope.js";

function textQuery(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const getMyProposals = async (req: Request, res: Response) => {
  const clientId = req.user!.clientId!;
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    companyId: "",
    clientId,
    status: textQuery(req.query.status) as ProposalStatus | undefined,
  };
  const result = await proposalService.getAllByClientId(clientId, options);
  res.json(result);
};

export const respondToProposal = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { action, comment, expectedVersion } = req.body as {
    action: string;
    comment?: string;
    expectedVersion?: number;
  };
  const clientId = req.user!.clientId as string;
  const proposal = await proposalService.getByIdForClient(id, clientId);
  if (!proposal) throw new HttpError(404, "Proposal not found");
  if (proposal.clientId !== clientId) throw new HttpError(403, "Forbidden");
  const companyId = proposal.companyId as string;
  if (action === "accept") {
    const result = await proposalService.accept(id, companyId, expectedVersion);
    return res.json({ data: result });
  }
  if (action === "reject") {
    const result = await proposalService.reject(id, companyId, comment);
    return res.json({ data: result });
  }
  throw new HttpError(400, "Invalid action — use 'accept' or 'reject'");
};

export const getProposals = async (req: Request, res: Response) => {
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
    companyId: req.user!.companyId as string,
    clientId: textQuery(req.query.clientId),
    status: textQuery(req.query.status) as ProposalStatus | undefined,
    search: textQuery(req.query.search),
  };
  const result = await proposalService.getAll(options, await buildServiceScope(req));
  res.json(result);
};

export const getProposalById = async (req: Request, res: Response) => {
  const proposal = await proposalService.getById(
    req.params.id as string,
    req.user!.companyId as string,
    await buildServiceScope(req)
  );
  res.json({ data: proposal });
};

export const createProposal = async (req: Request, res: Response) => {
  const proposal = await proposalService.create(
    req.body,
    req.user!.companyId as string
  );
  res.status(201).json({ data: proposal });
};

export const updateProposal = async (req: Request, res: Response) => {
  const proposal = await proposalService.update(
    req.params.id as string,
    req.user!.companyId as string,
    req.body,
    req.user!.id,
    await buildServiceScope(req)
  );
  res.json({ data: proposal });
};

export const deleteProposal = async (req: Request, res: Response) => {
  await proposalService.delete(req.params.id as string, req.user!.companyId as string);
  res.status(204).send();
};

export const sendProposal = async (req: Request, res: Response) => {
  const proposal = await proposalService.send(
    req.params.id as string,
    req.user!.companyId as string,
    await buildServiceScope(req)
  );
  res.json({ data: proposal });
};

export const acceptProposal = async (req: Request, res: Response) => {
  // Guard manager scope before the (shared) accept logic.
  await proposalService.getById(req.params.id as string, req.user!.companyId as string, await buildServiceScope(req));
  const proposal = await proposalService.accept(
    req.params.id as string,
    req.user!.companyId as string,
    req.body?.expectedVersion
  );
  res.json({ data: proposal });
};

export const rejectProposal = async (req: Request, res: Response) => {
  // Guard manager scope before the (shared) reject logic.
  await proposalService.getById(req.params.id as string, req.user!.companyId as string, await buildServiceScope(req));
  const proposal = await proposalService.reject(
    req.params.id as string,
    req.user!.companyId as string,
    req.body.comment
  );
  res.json({ data: proposal });
};

export const addProposalSection = async (req: Request, res: Response) => {
  const section = await proposalService.addSection(
    req.params.id as string,
    req.user!.companyId as string,
    req.body,
    await buildServiceScope(req)
  );
  res.status(201).json({ data: section });
};

export const updateProposalSection = async (req: Request, res: Response) => {
  const section = await proposalService.updateSection(
    req.params.sectionId as string,
    req.user!.companyId as string,
    req.body,
    req.user!.id,
    await buildServiceScope(req)
  );
  res.json({ data: section });
};

export const deleteProposalSection = async (req: Request, res: Response) => {
  await proposalService.deleteSection(
    req.params.sectionId as string,
    req.user!.companyId as string,
    req.user!.id,
    await buildServiceScope(req)
  );
  res.status(204).send();
};
