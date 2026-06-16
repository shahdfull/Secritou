// Lead Controller - HTTP request handlers
import type { RequestHandler } from "express";
import { leadService } from "../services/lead.service.js";

export const getLeads: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const leads = await leadService.getLeads(companyId);
    res.json({ data: leads });
  } catch (error) {
    next(error);
  }
};

export const getLead: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const lead = await leadService.getLead(req.params.id as string, companyId);
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
    const lead = await leadService.updateLead(req.params.id as string, req.body, companyId);
    res.json({ data: lead });
  } catch (error) {
    next(error);
  }
};

export const deleteLead: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    await leadService.deleteLead(req.params.id as string, companyId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const convertLeadToClient: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const client = await leadService.convertLeadToClient(req.params.id as string, companyId);
    res.status(201).json({ data: client });
  } catch (error) {
    next(error);
  }
};
