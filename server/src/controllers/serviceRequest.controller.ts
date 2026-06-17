import type { RequestHandler } from "express";
import { serviceRequestService } from "../services/serviceRequest.service.js";
import { parseListQuery } from "../utils/listQuery.js";

export const getClientServiceRequests: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user?.clientId!;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await serviceRequestService.getServiceRequestsByClient(clientId, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createClientServiceRequest: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user?.clientId!;
    const companyId = req.user?.companyId!;
    const request = await serviceRequestService.createServiceRequest({ ...req.body, clientId, companyId });
    res.status(201).json({ data: request });
  } catch (error) {
    next(error);
  }
};

export const getCompanyServiceRequests: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await serviceRequestService.getServiceRequestsByCompany(companyId, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateServiceRequest: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId ?? undefined;
    const request = await serviceRequestService.updateServiceRequest(req.params.id as string, req.body, companyId);
    res.json({ data: request });
  } catch (error) {
    next(error);
  }
};
