// Client Controller - HTTP request handlers
import type { RequestHandler } from "express";
import { clientService } from "../services/client.service.js";
import { creditNoteService } from "../services/creditNote.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { buildServiceScope } from "../utils/serviceScope.js";
import { HttpError } from "../utils/httpError.js";

export const getClients: RequestHandler = async (req, res, next) => {
  try {
    const options = {
      ...parseListQuery(req.query as Record<string, unknown>),
      includeArchived: req.query.includeArchived === "true",
    };
    const result = await clientService.getClients(options, await buildServiceScope(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getDeletedClients: RequestHandler = async (req, res, next) => {
  try {
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await clientService.getDeletedClients(options, await buildServiceScope(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getClient: RequestHandler = async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const client = await clientService.getClient(req.params.id as string, await buildServiceScope(req), includeArchived);
    res.json({ data: client });
  } catch (error) {
    next(error);
  }
};

export const createClient: RequestHandler = async (req, res, next) => {
  try {
    const client = await clientService.createClient(req.body);
    res.status(201).json({ data: client });
  } catch (error) {
    next(error);
  }
};

export const updateClient: RequestHandler = async (req, res, next) => {
  try {
    const client = await clientService.updateClient(req.params.id as string, req.body);
    res.json({ data: client });
  } catch (error) {
    next(error);
  }
};

export const deleteClient: RequestHandler = async (req, res, next) => {
  try {
    await clientService.deleteClient(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const restoreClient: RequestHandler = async (req, res, next) => {
  try {
    const client = await clientService.restoreClient(req.params.id as string);
    res.json({ data: client });
  } catch (error) {
    next(error);
  }
};

export const archiveClient: RequestHandler = async (req, res, next) => {
  try {
    const client = await clientService.archiveClient(req.params.id as string);
    res.json({ data: client });
  } catch (error) {
    next(error);
  }
};

export const inviteClientUser: RequestHandler = async (req, res, next) => {
  try {
    const { email, name } = req.body as { email: string; name: string };
    if (req.user!.role === "MANAGER") {
      const client = await clientService.getClient(req.params.id as string, await buildServiceScope(req));
      if (!client) throw new HttpError(403, "Client not in your service scope");
    }
    const result = await clientService.inviteClientUser(
      req.params.id as string,
      email,
      name
    );
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getMyClient: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user!.clientId;
    if (!clientId) throw new HttpError(400, "User has no associated client");
    const client = await clientService.getClient(clientId);
    res.json({ data: client });
  } catch (error) {
    next(error);
  }
};

export const getMyCreditNotes: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user!.clientId;
    if (!clientId) throw new HttpError(400, "User has no associated client");
    const creditNotes = await creditNoteService.listByClient(clientId);
    res.json({ data: creditNotes });
  } catch (error) {
    next(error);
  }
};

export const getClientCreditNotes: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.params.id as string;
    if (req.user!.role === "MANAGER") {
      const client = await clientService.getClient(clientId, await buildServiceScope(req));
      if (!client) throw new HttpError(403, "Client not in your service scope");
    }
    const creditNotes = await creditNoteService.listByClient(clientId);
    res.json({ data: creditNotes });
  } catch (error) {
    next(error);
  }
};
