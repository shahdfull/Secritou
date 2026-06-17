import type { RequestHandler } from "express";
import { freelancerApplicationService } from "../services/freelancerApplication.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createFreelancerApplicationValidator,
  acceptFreelancerApplicationValidator,
} from "../validators/freelancerApplication.validator.js";

export const getApplications: RequestHandler = async (req, res, next) => {
  try {
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await freelancerApplicationService.getAllApplications({
      ...options,
      status: req.query.status as any,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getApplicationById: RequestHandler = async (req, res, next) => {
  try {
    const application = await freelancerApplicationService.getApplicationById(
      req.params.id as string
    );
    res.json({ data: application });
  } catch (error) {
    next(error);
  }
};

export const createApplication: RequestHandler = [
  validate(createFreelancerApplicationValidator),
  async (req, res, next) => {
    try {
      const application = await freelancerApplicationService.createApplication(
        req.body
      );
      res.status(201).json({ data: application });
    } catch (error) {
      next(error);
    }
  },
];

export const rejectApplication: RequestHandler = async (req, res, next) => {
  try {
    const application = await freelancerApplicationService.rejectApplication(
      req.params.id as string,
      req.body.rejectionReason
    );
    res.json({ data: application });
  } catch (error) {
    next(error);
  }
};

export const acceptApplication: RequestHandler = [
  validate(acceptFreelancerApplicationValidator),
  async (req, res, next) => {
    try {
      const result = await freelancerApplicationService.acceptApplication(
        req.params.id as string,
        req.body
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
];
