// Client Controller - HTTP request handlers
import type { RequestHandler } from "express";
import { clientService } from "../services/client.service.js";

export const getClients: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const clients = await clientService.getClients(companyId);
    res.json({ data: clients });
  } catch (error) {
    next(error);
  }
};

export const getClient: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const client = await clientService.getClient(req.params.id as string, companyId);
    res.json({ data: client });
  } catch (error) {
    next(error);
  }
};

export const createClient: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const client = await clientService.createClient(req.body, companyId);
    res.status(201).json({ data: client });
  } catch (error) {
    next(error);
  }
};

export const updateClient: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const client = await clientService.updateClient(req.params.id as string, req.body, companyId);
    res.json({ data: client });
  } catch (error) {
    next(error);
  }
};

export const deleteClient: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    await clientService.deleteClient(req.params.id as string, companyId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
