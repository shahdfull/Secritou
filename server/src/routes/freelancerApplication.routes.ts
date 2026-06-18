import express from "express";
import {
  getApplications,
  getApplicationById,
  createApplication,
  rejectApplication,
  acceptApplication,
} from "../controllers/freelancerApplication.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = express.Router();

// Public route: create application
router.post("/", createApplication);

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
router.get("/:id", authenticate, authorize("ADMIN"), getApplicationById);
router.post("/:id/reject", authenticate, authorize("ADMIN"), rejectApplication);
router.post("/:id/accept", authenticate, authorize("ADMIN"), acceptApplication);

export default router;
