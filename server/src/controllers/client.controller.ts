// Client Controller - HTTP request handlers
import type { RequestHandler } from "express";
import { clientService } from "../services/client.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { buildServiceScope } from "../utils/serviceScope.js";
import { COMPANY_ID } from "../config/constants.js";

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

export const getClient: RequestHandler = async (req, res, next) => {
  try {
    const client = await clientService.getClient(req.params.id as string, await buildServiceScope(req));
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
