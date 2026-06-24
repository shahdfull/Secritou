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
  if (action === "accept") {
    const result = await proposalService.acceptWithCascade(id, expectedVersion, req.user!.id);
    return res.json({
      data: result.proposal,
      meta: {
        projectId: result.projectId,
        invoiceId: result.invoiceId,
        clientInvited: result.clientInvited,
      },
    });
  }
  if (action === "reject") {
    const result = await proposalService.reject(id, comment);
    return res.json({ data: result });
  }
  throw new HttpError(400, "Invalid action : use 'accept' or 'reject'");
};

export const getProposals = async (req: Request, res: Response) => {
  const options = {
    ...parseListQuery(req.query as Record<string, unknown>),
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
    await buildServiceScope(req)
  );
  res.json({ data: proposal });
};

export const createProposal = async (req: Request, res: Response) => {
  if (req.user!.role === "MANAGER" && req.body.projectId) {
    const scope = await buildServiceScope(req);
    if (scope.userServiceId !== undefined) {
      const project = await (await import("../services/project.service.js")).projectService.getProjectById(req.body.projectId, req.user!.sub!, "MANAGER", scope.userServiceId ?? undefined);
      if (!project) throw new HttpError(403, "Project not in your service scope");
    }
  }
  const proposal = await proposalService.create(req.body);
  res.status(201).json({ data: proposal });
};

export const updateProposal = async (req: Request, res: Response) => {
  const proposal = await proposalService.update(
    req.params.id as string,
    req.body,
    req.user!.id,
    await buildServiceScope(req)
  );
  res.json({ data: proposal });
};

export const deleteProposal = async (req: Request, res: Response) => {
  await proposalService.delete(req.params.id as string);
  res.status(204).send();
};

export const sendProposal = async (req: Request, res: Response) => {
  const proposal = await proposalService.send(
    req.params.id as string,
    req.user!.id,
    await buildServiceScope(req)
  );
  res.json({ data: proposal });
};

export const acceptProposal = async (req: Request, res: Response) => {
  // Guard manager scope before the cascade.
  await proposalService.getById(req.params.id as string, await buildServiceScope(req));
  const result = await proposalService.acceptWithCascade(
    req.params.id as string,
    req.body?.expectedVersion,
    req.user!.id
  );
  // `data` stays the proposal (backward compatible); `meta` carries the cascade results so the
  // client can toast the invitation and navigate to the freshly-created project.
  res.json({
    data: result.proposal,
    meta: {
      projectId: result.projectId,
      invoiceId: result.invoiceId,
      clientInvited: result.clientInvited,
    },
  });
};

export const rejectProposal = async (req: Request, res: Response) => {
  const scope = await buildServiceScope(req);
  await proposalService.getById(req.params.id as string, scope);
  const proposal = await proposalService.reject(req.params.id as string, req.body.comment);
  res.json({ data: proposal });
};

export const addProposalSection = async (req: Request, res: Response) => {
  const section = await proposalService.addSection(
    req.params.id as string,
    req.body,
    await buildServiceScope(req)
  );
  res.status(201).json({ data: section });
};

export const updateProposalSection = async (req: Request, res: Response) => {
  const section = await proposalService.updateSection(
    req.params.sectionId as string,
    req.body,
    req.user!.id,
    await buildServiceScope(req)
  );
  res.json({ data: section });
};

export const deleteProposalSection = async (req: Request, res: Response) => {
  await proposalService.deleteSection(
    req.params.sectionId as string,
    req.user!.id,
    await buildServiceScope(req)
  );
  res.status(204).send();
};
