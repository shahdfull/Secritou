import type { RequestHandler } from "express";
import { freelancerService } from "../services/freelancer.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { buildServiceScope } from "../utils/serviceScope.js";

export const getFreelancers: RequestHandler = async (req, res, next) => {
  try {
    const options = parseListQuery(req.query as Record<string, unknown>);
    const scope = req.user!.role === "MANAGER" ? await buildServiceScope(req) : undefined;
    const result = await freelancerService.getAll({ ...options, serviceId: scope?.userServiceId });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getFreelancerById: RequestHandler = async (req, res, next) => {
  try {
    const profile = await freelancerService.getById(req.params.id);
    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
};

export const createMyProfile: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    const profile = await freelancerService.createMyProfile(
      userId,
      userRole,
      req.body
    );
    res.status(201).json({ data: profile });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfile: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    const profile = await freelancerService.updateMyProfile(
      userId,
      userRole,
      req.body
    );
    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
};

export const deleteMyProfile: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub!;
    const userRole = req.user?.role!;
    await freelancerService.deleteMyProfile(userId, userRole);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
