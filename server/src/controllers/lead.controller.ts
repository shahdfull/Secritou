// Lead Controller - HTTP request handlers
import type { Request, RequestHandler } from "express";
import { leadService } from "../services/lead.service.js";
import { userRepository } from "../repositories/user.repository.js";
import { parseListQuery } from "../utils/listQuery.js";
import type { LeadScope } from "../repositories/lead.repository.js";

// Build the access scope for the current user. ADMIN is unscoped; a MANAGER is restricted to
// their own service (pole), resolved from the DB (the JWT does not carry serviceId).
async function buildScope(req: Request): Promise<LeadScope> {
  const role = req.user!.role;
  if (role === "MANAGER") {
    const userServiceId = await userRepository.findServiceId(req.user!.id);
    return { userRole: role, userServiceId };
  }
  return { userRole: role };
}

export const getLeads: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await leadService.getLeads(companyId, options, await buildScope(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getLead: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const lead = await leadService.getLead(req.params.id as string, companyId, await buildScope(req));
    res.json({ data: lead });
  } catch (error) {
    next(error);
  }
};

export const createLead: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const lead = await leadService.createLead(req.body, companyId);
    res.status(201).json({ data: lead });
  } catch (error) {
    next(error);
  }
};

export const updateLead: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const lead = await leadService.updateLead(req.params.id as string, req.body, companyId, await buildScope(req));
    res.json({ data: lead });
  } catch (error) {
    next(error);
  }
};

export const deleteLead: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    await leadService.deleteLead(req.params.id as string, companyId, await buildScope(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const convertLeadToClient: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const client = await leadService.convertLeadToClient(req.params.id as string, companyId, await buildScope(req));
    res.status(201).json({ data: client });
  } catch (error) {
    next(error);
  }
};
