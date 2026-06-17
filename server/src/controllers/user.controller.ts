import type { RequestHandler } from "express";
import { userService, permissionsMatrix } from "../services/user.service.js";
import { HttpError } from "../utils/httpError.js";
import { parseListQuery } from "../utils/listQuery.js";

export const getUsers: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) throw new HttpError(403, "Company not found");
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await userService.getUsersByCompany(companyId, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const inviteUser: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) throw new HttpError(403, "Company not found");
    const { name, email, role } = req.body;
    const user = await userService.inviteUser(companyId, email, name, role);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const updateUser: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) throw new HttpError(403, "Company not found");
    const { id } = req.params;
    const { name, role } = req.body;
    const user = await userService.updateUser(id as string, companyId, name, role);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const deleteUser: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) throw new HttpError(403, "Company not found");
    const { id } = req.params;
    await userService.deleteUser(id as string, companyId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getPermissions: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: permissionsMatrix });
  } catch (error) {
    next(error);
  }
};
