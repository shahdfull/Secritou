import type { RequestHandler } from "express";
import { serviceRequestService } from "../services/serviceRequest.service.js";

export const getClientServiceRequests: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user?.clientId!;
    const requests = await serviceRequestService.getServiceRequestsByClient(clientId);
    res.json({ data: requests });
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
    const requests = await serviceRequestService.getServiceRequestsByCompany(companyId);
    res.json({ data: requests });
  } catch (error) {
    next(error);
  }
};

export const updateServiceRequest: RequestHandler = async (req, res, next) => {
  try {
    const request = await serviceRequestService.updateServiceRequest(req.params.id, req.body);
    res.json({ data: request });
  } catch (error) {
    next(error);
  }
};
