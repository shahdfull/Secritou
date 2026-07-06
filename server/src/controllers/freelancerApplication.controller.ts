import type { RequestHandler } from "express";
import multer from "multer";
import { freelancerApplicationService } from "../services/freelancerApplication.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createFreelancerApplicationValidator,
  acceptFreelancerApplicationValidator,
  rejectFreelancerApplicationValidator,
} from "../validators/freelancerApplication.validator.js";
import { COMPANY_ID } from "../config/constants.js";
import { HttpError } from "../utils/httpError.js";
import logger from "../utils/logger.js";

export const CV_MAX_BYTES = 10 * 1024 * 1024;
export const PORTFOLIO_MAX_BYTES = 20 * 1024 * 1024;

// Multer has no per-field size limit, so each file is checked individually
// against its own cap after the (shared, larger) Multer-level limit passes.
export function assertFileSizeLimits(cvFile: { size: number }, portfolioFile: { size: number }): void {
  if (cvFile.size > CV_MAX_BYTES) {
    throw new HttpError(413, "CV file exceeds the 10MB limit", "CV_TOO_LARGE", { maxMb: 10 });
  }
  if (portfolioFile.size > PORTFOLIO_MAX_BYTES) {
    throw new HttpError(413, "Portfolio file exceeds the 20MB limit", "PORTFOLIO_TOO_LARGE", { maxMb: 20 });
  }
}

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

// Multer's own limit is set to the larger of the two (portfolio); each field
// is then checked individually below since Multer has no per-field limit.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PORTFOLIO_MAX_BYTES }
});

export const createApplication: RequestHandler[] = [
  // Parse multipart form data with two files
  upload.fields([
    { name: "cvFile", maxCount: 1 },
    { name: "portfolioFile", maxCount: 1 },
  ]),
  // Validate text fields after multer has populated req.body from the multipart form.
  validate(createFreelancerApplicationValidator),

  async (req, res, next) => {
    try {
      // Honeypot: a hidden field real candidates never fill. If a bot fills
      // it, pretend success (no DB write, no email, no file processing)
      // instead of a 400/validation error that would reveal the trap.
      if (req.body.website) {
        logger.info({ ip: req.ip }, "Freelancer application honeypot triggered");
        res.status(201).json({ data: { id: "pending-review" } });
        return;
      }

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
      assertFileSizeLimits(cvFile, portfolioFile);

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

export const rejectApplication: RequestHandler[] = [
  validate(rejectFreelancerApplicationValidator),
  async (req, res, next) => {
    try {
      const application = await freelancerApplicationService.rejectApplication(
        req.params.id as string,
        req.body.rejectionReason
      );
      res.json({ data: application });
    } catch (error) {
      next(error);
    }
  },
];

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
