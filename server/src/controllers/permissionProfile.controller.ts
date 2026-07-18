import type { RequestHandler } from "express";
import { permissionProfileService } from "../services/managerPermission.service.js";

export const getPermissionProfiles: RequestHandler = async (req, res, next) => {
  try {
    const profiles = await permissionProfileService.findAll();
    res.json({ data: profiles });
  } catch (error) {
    next(error);
  }
};

export const createPermissionProfile: RequestHandler = async (req, res, next) => {
  try {
    const profile = await permissionProfileService.create(req.body);
    res.status(201).json({ data: profile });
  } catch (error) {
    next(error);
  }
};

export const updatePermissionProfile: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const profile = await permissionProfileService.update(id, req.body);
    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
};

export const deletePermissionProfile: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await permissionProfileService.delete(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
