import type { RequestHandler } from "express";
import { serviceRequestService } from "../services/serviceRequest.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import type { ServiceRequestStatus, Priority, ServiceRequestType } from "@prisma/client";

// ─── Client handlers ──────────────────────────────────────────────────────────

export const getClientServiceRequests: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user!.clientId!;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await serviceRequestService.getServiceRequestsByClient(clientId, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createClientServiceRequest: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user!.clientId!;
    const request = await serviceRequestService.createServiceRequest({ ...req.body, clientId });
    res.status(201).json({ data: request });
  } catch (error) {
    next(error);
  }
};

// ─── Admin / Manager handlers ─────────────────────────────────────────────────

export const adminGetServiceRequests: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as Record<string, unknown>;
    const options = {
      ...parseListQuery(query),
      status: (query.status as ServiceRequestStatus | undefined) ?? undefined,
      clientId: (query.clientId as string | undefined) ?? undefined,
      assignedToId: (query.assignedToId as string | undefined) ?? undefined,
      priority: (query.priority as Priority | undefined) ?? undefined,
      type: (query.type as ServiceRequestType | undefined) ?? undefined,
    };
    const result = await serviceRequestService.getServiceRequestsByCompany(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const adminGetServiceRequestById: RequestHandler = async (req, res, next) => {
  try {
    const request = await serviceRequestService.getServiceRequestById(req.params["id"] as string);
    res.json({ data: request });
  } catch (error) {
    next(error);
  }
};

export const adminUpdateServiceRequest: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const request = await serviceRequestService.adminUpdateServiceRequest(req.params["id"] as string, userId, req.body);
    res.json({ data: request });
  } catch (error) {
    next(error);
  }
};

export const adminDeleteServiceRequest: RequestHandler = async (req, res, next) => {
  try {
    await serviceRequestService.deleteServiceRequest(req.params["id"] as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const addComment: RequestHandler = async (req, res, next) => {
  try {
    const authorId = req.user!.sub;
    const { body, isInternal } = req.body as { body: string; isInternal?: boolean };
    const comment = await serviceRequestService.addComment(req.params["id"] as string, authorId, body, isInternal ?? false);
    res.status(201).json({ data: comment });
  } catch (error) {
    next(error);
  }
};

export const deleteComment: RequestHandler = async (req, res, next) => {
  try {
    const authorId = req.user!.sub;
    await serviceRequestService.deleteComment(req.params["commentId"] as string, authorId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getCompanyServiceRequests = adminGetServiceRequests;
