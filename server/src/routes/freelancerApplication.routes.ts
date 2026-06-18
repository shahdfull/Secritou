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

// Protected routes: admin only
router.get("/", authenticate, authorize("ADMIN"), getApplications);
router.get("/:id", authenticate, authorize("ADMIN"), getApplicationById);
router.post("/:id/reject", authenticate, authorize("ADMIN"), rejectApplication);
router.post("/:id/accept", authenticate, authorize("ADMIN"), acceptApplication);

export default router;
