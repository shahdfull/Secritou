import type { RequestHandler } from "express";
import { userService, permissionsMatrix } from "../services/user.service.js";
import { HttpError } from "../utils/httpError.js";
import { parseListQuery } from "../utils/listQuery.js";
import { COMPANY_ID } from "../config/constants.js";

// GET /users/me : any authenticated role
export const getMe: RequestHandler = async (req, res, next) => {
  try {
    const user = await userService.getMe(req.user!.sub);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

// PATCH /users/me : any authenticated role
export const updateMe: RequestHandler = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
    };
    const user = await userService.updateMe(req.user!.sub, { name, email, phone });
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const getUsers: RequestHandler = async (req, res, next) => {
  try {
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await userService.getUsersByCompany(COMPANY_ID, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const inviteUser: RequestHandler = async (req, res, next) => {
  try {
    const { name, email, role } = req.body;
    const user = await userService.inviteUser(COMPANY_ID, email, name, role);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const updateUser: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role } = req.body;
    const user = await userService.updateUser(id as string, COMPANY_ID, name, role);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const deleteUser: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    await userService.deleteUser(id as string, COMPANY_ID);
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
