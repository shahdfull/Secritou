import express from "express";
import {
  getApplications,
  getApplicationById,
  getPendingApplications,
  createApplication,
  rejectApplication,
  acceptApplication,
} from "../controllers/freelancerApplication.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit, applicationRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

// Public route: create application
router.post("/", applicationRateLimit, createApplication);

/**
 * @swagger
 * /freelancer-applications:
 *   get:
 *     summary: List all freelancer applications
 *     tags: [FreelancerApplications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by application status
 *     responses:
 *       200:
 *         description: List of applications
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", authenticate, authorize("ADMIN"), getApplications);
router.get("/pending", authenticate, authorize("ADMIN"), getPendingApplications);
router.get("/:id", authenticate, authorize("ADMIN"), getApplicationById);
router.post("/:id/reject", authenticate, sensitiveWriteRateLimit, authorize("ADMIN"), rejectApplication);
router.post("/:id/accept", authenticate, sensitiveWriteRateLimit, authorize("ADMIN"), acceptApplication);

export default router;
