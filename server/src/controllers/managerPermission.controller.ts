import type { RequestHandler } from "express";
import { managerPermissionService } from "../services/managerPermission.service.js";
import { HttpError } from "../utils/httpError.js";

export const getManagerPermission: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.params.userId as string;
    const permission = await managerPermissionService.findByUserId(userId);
    res.json({ data: permission });
  } catch (error) {
    next(error);
  }
};

export const updateManagerPermission: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.params.userId as string;
    const permission = await managerPermissionService.update(userId, req.body);
    res.json({ data: permission });
  } catch (error) {
    next(error);
  }
};

export const getMyPermissions: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError(401, "Unauthorized");
    const permissions = await managerPermissionService.resolvePermissions(userId);
    res.json({ data: permissions });
  } catch (error) {
    next(error);
  }
};
