import type { RequestHandler } from "express";
import { freelancerService } from "../services/freelancer.service.js";

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
