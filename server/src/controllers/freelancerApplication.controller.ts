import type { RequestHandler } from "express";
import multer from "multer";
import { freelancerApplicationService } from "../services/freelancerApplication.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createFreelancerApplicationValidator,
  acceptFreelancerApplicationValidator,
} from "../validators/freelancerApplication.validator.js";
import { COMPANY_ID } from "../config/constants.js";

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

// Multer for handling file uploads
const upload = multer({ storage: multer.memoryStorage() });

export const createApplication: RequestHandler[] = [
  // Parse multipart form data with two files
  upload.fields([
    { name: "cvFile", maxCount: 1 },
    { name: "portfolioFile", maxCount: 1 },
  ]),

  async (req, res, next) => {
    try {
      const cvFile = (req.files as any)?.cvFile?.[0];
      const portfolioFile = (req.files as any)?.portfolioFile?.[0];

      if (!cvFile) {
        res.status(400).json({ error: "CV file is required" });
        return;
      }
      if (!portfolioFile) {
        res.status(400).json({ error: "Portfolio file is required" });
        return;
      }

      const application = await freelancerApplicationService.createApplication(
        {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          phone: req.body.phone,
          position: req.body.position,
          bio: req.body.bio,
          role: req.body.role,
        },
        cvFile,
        portfolioFile
      );
      res.status(201).json({ data: application });
    } catch (error) {
      next(error);
    }
  },
];

export const getPendingApplications: RequestHandler = async (req, res, next) => {
  try {
    const applications = await freelancerApplicationService.getPendingApplications();
    res.json({ data: applications });
  } catch (error) {
    next(error);
  }
};

export const assignApplication: RequestHandler = async (req, res, next) => {
  try {
    const application = await freelancerApplicationService.assignApplicationToCompany(
      req.params.id as string
    );
    res.json({ data: application });
  } catch (error) {
    next(error);
  }
};

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

export const acceptApplication: RequestHandler[] = [
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
